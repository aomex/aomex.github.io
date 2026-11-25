---
outline: deep
---

# マルチプロセスとスケールアウト

単一プロセスで多核を使い切れない、あるいは QPS を上げたいときは Node を複数起動します。よくあるやり方は**どれか一つだけ**選びます。重ねるとプロセス数が掛け算になります（例：PM2 `-i 4` のうえに `clusterListen({ workers: 4 })` → 16 本の業務プロセス）。

まず二層の役割を押さえます。

| 層 | 役割 |
| --- | --- |
| **誰がプロセス／レプリカを管理するか** | Docker / K8s / PM2 / systemd / マネージドホスト… が起動数・再起動・ローリングを担当 |
| **アプリのエントリに何を書くか** | ほとんどの場合：**1 プロセスで `app.listen` は 1 回だけ**。「単機で cluster を内蔵し、別マネージャなし」のときだけ `clusterListen` |

メモリ上のレート制限、memory キャッシュ、プロセス内 Map は**プロセス間で共有されません**。複数レプリカではカウントと session は Redis など外部ストアへ。 [レート制限](/ja/plugins/rate-limit) · [キャッシュ](/ja/core/cache) を参照。

## 選び方

| 方式 | 向いている場面 |
| --- | --- |
| **リバースプロキシ + 複数インスタンス** | ベアメタル / 従来 VM：Nginx / Caddy / HAProxy の背後に複数 Node ポート |
| **systemd**（複数 unit / テンプレート） | Linux 単機。システムサービスと同じ起停・ログで、Node 専用マネージャを使わない |
| **PM2 `-i` / `instances`** | 単機 VM。プロセス管理・ログ集約・ゼロダウン reload |
| **`clusterListen`** | 単機 / VM。Node 標準 `cluster` を使い、別プロセスマネージャなし |
| **Docker Compose `scale` / Swarm + Nginx** | コンテナ化済み。同一スタックでプロキシ、DNS がレプリカをラウンドロビン |
| **K8s `replicas` / HPA** | 本番オーケストレーション：ロールアウト、プローブ、クォータ、自動スケール |
| **マネージドのレプリカ**（ECS/Fargate、Cloud Run、Container Apps…） | オーケストレーションを任せたい。「イメージ内単一プロセス × レプリカ数」と同じ意味論 |
| **PaaS 水平スケール**（Fly.io、Render、Heroku dyno…） | プラットフォームが「インスタンス数」で拡張。エントリは単一プロセス listen のまま |

以下、シナリオ別に展開します。クラウドコンソールの「レプリカ / instances」も Docker / K8s と同じ原則で、ベンダーごとにコマンドは繰り返しません。

## 単一プロセスのエントリ（多くの構成で共通）

Docker、K8s、マネージドホスト、PaaS、systemd、Nginx 複数 upstream、PM2 `-i` — エントリは普通の単一プロセス listen。イメージの `CMD`、systemd の `ExecStart`、`pm2 start` はこのファイルを指せばよいです。

```typescript
import { routers, WebApp } from '@aomex/web';
import { services } from '@/services';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [routers('./src/routers')],
});
app.http({ keepAliveTimeout: 61_000 }).listen(process.env.PORT || 3000);
```

シャットダウンは [グレースフルシャットダウン](/ja/web/#shutdown) と揃えます。オーケストレータやプロセスマネージャが `SIGTERM` を送り、接続を捌いてから終了します。

## リバースプロキシ + 複数インスタンス

コンテナオーケストレーションを入れないときの定番：同一または複数ホストで Node を複数起動（ポートまたはホストを分ける）し、手前で Nginx / Caddy / HAProxy が負荷分散。

```nginx
upstream aomex {
  least_conn;
  server 127.0.0.1:3001;
  server 127.0.0.1:3002;
  server 127.0.0.1:3003;
}

server {
  listen 80;
  location / {
    proxy_pass http://aomex;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

各バックエンドは上記の単一プロセスエントリ（`PORT=3001` / `3002`…）。WebApp は [proxyIP](/ja/web/) を正しく設定しないと、レート制限キーや監査ログがクライアントではなくプロキシのアドレスになります。スケールアウト = プロセスを増やして upstream を更新。ヘルスチェックと接続ドレインはプロキシまたはデプロイスクリプト側。

## systemd

Linux ではアプリをシステムサービスに登録できます。起動時自動起動、クラッシュ再起動、journal ログ — Nginx と同じ運用感。複数プロセスは**複数 unit** または **テンプレート unit**（`aomex@3001`、`aomex@3002`）で、インスタンスごとに `PORT`、手前はリバースプロキシ。

```ini
# /etc/systemd/system/aomex@.service の抜粋
[Service]
Environment=PORT=%i
ExecStart=/usr/bin/node /opt/aomex/dist/main.js
Restart=on-failure
KillSignal=SIGTERM
TimeoutStopSec=15
```

```bash
systemctl enable --now aomex@3001 aomex@3002 aomex@3003
```

`TimeoutStopSec` はアプリの `shutdown.timeout` を上回るように。ここでは `ExecStart` に `clusterListen` や PM2 を**重ねない**でください。

## PM2

オーケストレーションなしで Node 系のプロセス管理が欲しい単機では PM2：複数インスタンス、ログ、`reload` でゼロダウン。エントリは単一プロセス listen のまま、インスタンス数は `-i` に任せます。

```bash
pm2 start dist/main.js -i max
# または ecosystem：instances: 'max' / 数値、exec_mode: 'cluster'
```

`-i max` はだいたい CPU コア数相当。数値指定の方が制御しやすいです。PM2 の cluster モードを使っているので、**`clusterListen` は重ねない**。

## clusterListen

PM2 / systemd 複数 unit を入れず、単機で Node 標準 `cluster` を使うときは `@aomex/web` の `clusterListen`：primary は `fork` とシグナル受信のみ、**実際の `listen` は worker だけ**。`WebApp.listen` 自体は変えず、worker 内は従来どおりのシャットダウン経路です。

App の構築と `listen` を `listen` コールバックに入れます（必要なら `import` services）。primary で業務初期化を無駄に走らせないためです。

```typescript
import { clusterListen, routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

clusterListen({ // [!code focus:18]
  workers: 'max', // または具体的な数、例：4
  listen: async () => {
    const { services } = await import('@/services');
    const app = new WebApp({
      services,
      logger,
      language: { mode: 'fixed', language: 'zh-CN' },
      proxyIP: { mode: 'detect' },
      mount: [routers('./src/routers')],
    });
    app.http({ keepAliveTimeout: 61_000 }).listen(process.env.PORT || 3000);
  },
});
```

`workers: 'max'` は `os.availableParallelism()` を使用。`Math.min(4, availableParallelism())` で上限をかけることもできます。primary が `SIGINT` / `SIGTERM` を受けると各 worker を `disconnect` し、終了を待ってから（タイムアウトで `SIGKILL`）`process.exit` します。

| オプション | 役割 | デフォルト |
| --- | --- | --- |
| `workers` | 数、または `'max'` | （必須） |
| `listen` | **worker のみ**で呼ぶ：App 構築と `listen` | （必須） |
| `respawn` | worker が予期せず落ちたあと再 `fork` するか | `true` |
| `respawnDelay` | 再 fork 前の待ち（ミリ秒） | `1000` |
| `maxRespawns` | 意図しない再起動の上限；超過で primary がコード `1` で終了 | 制限なし |
| `shutdownTimeout` | シャットダウン待ち、超過で強制終了 | `5000`（WebApp `shutdown.timeout` と同じ既定） |
| `onListening` / `onExit` | primary で worker の listen / 終了を観察 | — |

::: warning
リバースプロキシ複数インスタンス、systemd 複数 unit、Docker / マネージドレプリカ、K8s `replicas`、PM2 `-i`、PaaS 水平スケールを使っているときは **`clusterListen` を重ねない**。意図的シャットダウンや `disconnect` による終了は respawn されない。予期しないクラッシュだけが上記ポリシーで再起動される。
:::

## Docker Compose scale

イメージ内は**1 プロセス 1 回の `app.listen`**、レプリカ数は Compose に任せます。同じ `compose.yaml` に Nginx を載せることが多い：80/443 だけ公開し、サービス名 `web` にプロキシ — Docker 組み込み DNS が**同名サービスの複数レプリカ**を解決し、以下の書き方でラウンドロビンできます。Nginx に `3001`/`3002`/`3003` を手書きする必要はありません。

```yaml
# compose.yaml
services:
  web:
    build: .
    environment:
      PORT: '3000'
    # 外部 publish しない；compose ネットワーク内のみ
    deploy:
      replicas: 3 # [!code highlight]

  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - web
```

```bash
docker stack deploy -c compose.yaml aomex
# ローカルで Swarm なし、レプリカを試す：
# docker compose up --scale web=3 -d
```

`deploy` は Swarm 用：`docker stack deploy`（または互換ツール）でファイルどおり複数レプリカ。通常の `docker compose up` は **`deploy` を無視**することが多く、`--scale web=3` で一時指定できます。

Nginx ではサービス名を upstream に 1 行。Docker DNS は `web` を**当時の全レプリカのアドレス**に解決します。Nginx が複数 IP を得ればその間でラウンドロビン — **3 台の `server` を手書きしない**。

```nginx
# nginx.conf
events {}

http {
  upstream aomex {
    server web:3000; # [!code highlight]
  }

  server {
    listen 80;

    location / {
      proxy_pass http://aomex;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }
  }
}
```

注意：OSS Nginx は既定で**起動 / reload 時**にホスト名を解決してキャッシュします。レプリカ起動後に Nginx を起動（`depends_on: web`）なら上記でラウンドロビンできます。その後 `scale` で増減したら **`nginx -s reload`**（または Nginx コンテナ再起動）で再解決が必要。reload しないと peer 一覧が古いままです。

スケール後も **reload なし**で追従したい場合は Docker DNS（`resolver 127.0.0.11`）+ 変数形式の `proxy_pass`（`set $upstream web; proxy_pass http://$upstream:3000;`）で `valid` 周期に再解決。多くの同一スタックデプロイでは upstream + スケール後 reload で十分です。

WebApp は引き続き [proxyIP](/ja/web/) を正しく。イメージエントリで **`clusterListen` や PM2 `-i` を走らせない**。シャットダウンは `SIGTERM` と [グレースフルシャットダウン](/ja/web/#shutdown) に合わせる。

Traefik / Caddy など Docker provider 付きゲートウェイはラベルでレプリカを発見し、スケール時に Nginx 手 reload が不要なことが多いです。

## Kubernetes とマネージドホスティング

Docker と同じ考え方：**Pod / タスク内は単一プロセス**、レプリカ数でスケール。

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aomex-web
spec:
  replicas: 3 # [!code highlight]
  template:
    spec:
      containers:
        - name: web
          image: your-registry/aomex-web:latest
          ports:
            - containerPort: 3000
```

プローブと `terminationGracePeriodSeconds` はアプリの `shutdown.timeout` より大きく（少なくともカバーする）。でないとオーケストレータが先に強制終了します。HPA は CPU / カスタムメトリクスで `replicas` を増減し、アプリコードは変更不要です。

マネージドコンテナ（AWS ECS/Fargate、Google Cloud Run、Azure Container Apps、Alibaba ACK/SAE など）は「レプリカ、ローリング、プローブ」をコンソールまたは Terraform に集約します。届けるのは**単一プロセスイメージ**、スケールはプラットフォームへ。HashiCorp Nomad なども「job レプリカ × 単一プロセスタスク」は同じモデルです。

## PaaS 水平スケール

Fly.io Machines、Render services、Heroku dynos などは「インスタンス数」で拡張。プラットフォームが複数プロセスを起動してトラフィック分配。リポジトリのエントリは単一プロセス `listen` のまま、プラットフォームの scale / instances 設定で数を調整し、アプリ内で fork する必要はありません。

## 次のステップ

- [アプリケーションエントリ](/ja/web/)：`listen` / `shutdown` / proxyIP
- [レート制限](/ja/plugins/rate-limit)：複数レプリカでは共有 store
- [キャッシュ](/ja/core/cache)：session と Redis アダプタ