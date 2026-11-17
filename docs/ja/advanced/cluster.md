---
outline: deep
---

# マルチプロセスとスケール

1 プロセスではコアを使い切れない、または QPS を上げたいときは、複数の Node プロセスを動かす。代表的なやり方は **どれか 1 つだけ** 選ぶ——重ねるとプロセス数が掛け算になる（例: PM2 `-i 4` に `clusterListen({ workers: 4 })` を重ねる → 業務プロセス 16 個）。

まず 2 層の役割を押さえる:

| 層 | 役割 |
| --- | --- |
| **プロセス / レプリカを誰が管理するか** | Docker / K8s / PM2 / systemd / クラウドマネージド… が起動数・障害再起動・ローリングデプロイを担当 |
| **アプリ入口に何を書くか** | ほとんどの場合: **1 プロセスで `app.listen` は 1 回だけ**。「単機で Node 標準 cluster を使い、別のプロセス管理を入れない」ときだけ `clusterListen` |

メモリ上のレート制限・memory キャッシュ・プロセス内の Map はプロセス間で **共有されない**——レプリカ複数時はカウントや session を Redis など外部ストアに切り替える。[レート制限](/ja/plugins/rate-limit) · [キャッシュ](/ja/core/cache) を参照。

## 選び方

| 方式 | 向いているケース |
| --- | --- |
| **リバースプロキシ + 複数インスタンス** | ベアメタル / 従来 VM: Nginx / Caddy / HAProxy の後ろに複数 Node ポート |
| **systemd**（複数 unit / テンプレート） | Linux 単機で、システムサービスと同じ起動停止・ログに揃えたい（Node 専用 PM 不要） |
| **PM2 `-i` / `instances`** | 単一 VM でプロセス管理・ログ集約・無停止 reload |
| **`clusterListen`** | 単機 / VM で Node 標準 `cluster`、追加のプロセス管理なし |
| **Docker Compose `scale` / Swarm + Nginx** | コンテナ化済み。同一スタック内リバースプロキシ、DNS がレプリカを自動ラウンドロビン |
| **K8s `replicas` / HPA** | 本番オーケストレーション: ローリング・プローブ・クォータ・自動スケール |
| **クラウドマネージドレプリカ**（ECS/Fargate、Cloud Run、Container Apps…） | 管理オーケストレーションで制御面を減らす。意味は依然「イメージ内単一プロセス × レプリカ」 |
| **PaaS 水平スケール**（Fly.io、Render、Heroku dyno…） | プラットフォームが「インスタンス数」で拡張。入口は単一プロセス listen のまま |

以下、シナリオ別に詳述する。クラウドコンソールの「レプリカ / instances」は Docker / K8s と同じ原則で、ベンダーごとのコマンドは繰り返さない。

## 単一プロセス入口（多くの方式で共通）

Docker、K8s、クラウドマネージド、PaaS、systemd、Nginx 複数 upstream、PM2 `-i`——入口はいずれも通常の単一プロセス listen。イメージの `CMD`、systemd の `ExecStart`、`pm2 start` はこのファイルを指す:

```typescript
import { routers, WebApp } from '@aomex/web';
import { services } from './services/index.js';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [routers('./src/routers')],
});
app.http({ keepAliveTimeout: 61_000 }).listen(process.env.PORT || 3000);
```

停止は [グレースフルシャットダウン](/ja/web/#shutdown) と連動する: オーケストレータやプロセス管理が `SIGTERM` を送り、アプリが接続を捌いてから終了する。

## リバースプロキシ + 複数インスタンス

コンテナオーケストレーションを入れないときの定番: 同一または複数ホストで複数 Node（ポートまたはホストを分ける）を起動し、手前に Nginx / Caddy / HAProxy でロードバランス。

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

各バックエンドは上の単一プロセス入口（`PORT=3001` / `3002`…）。WebApp の [proxyIP](/ja/web/) を正しく設定しないと、レート制限キーや監査ログにクライアントではなくプロキシが見える。スケールはプロセスを増やして upstream を直すこと。ヘルスチェックと接続ドレインはプロキシかデプロイスクリプトが担う。

## systemd

Linux ではアプリをシステムサービスに登録できる: 起動時自動起動、クラッシュ再起動、journal ログ——Nginx と同じ運用感。複数プロセスは **複数 unit** または **テンプレート unit**（`aomex@3001`、`aomex@3002`）で、インスタンスごとに `PORT` を分け、手前にリバースプロキシ。

```ini
# /etc/systemd/system/aomex@.service 片段
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

`TimeoutStopSec` はアプリの `shutdown.timeout` をカバーする。ここで `ExecStart` に `clusterListen` や PM2 を **重ねない**。

## PM2

単機でオーケストレーションなし、Node 系のプロセス管理が欲しいときは PM2: 複数インスタンス起動、ログ、`reload` で無停止再読み込み。入口は単一プロセス listen のまま、インスタンス数は `-i` に任せる:

```bash
pm2 start dist/main.js -i max
# 或 ecosystem：instances: 'max' / 数字，exec_mode: 'cluster'
```

`-i max` はおおよそ CPU コア数に合わせる。数値指定の方が制御しやすい。すでに PM2 の cluster モードを使っているので、**`clusterListen` は重ねない**。

## clusterListen

PM2 や systemd 複数 unit を使わず、1 台で Node 標準 `cluster` を使うときは `@aomex/web` の `clusterListen`: primary は `fork` とシグナル受信だけ、**実際の `listen` は worker だけ**。`WebApp.listen` 自体は変えず、worker は従来のシャットダウン経路のまま。

App 構築と `listen` を `listen` コールバックに入れる（必要なら services を `import`）ことで、primary が業務初期化を無駄に走らせない:

```typescript
import { clusterListen, routers, WebApp } from '@aomex/web';

clusterListen({ // [!code focus:18]
  workers: 'max', // 或具体数字，如 4
  listen: async () => {
    const { services } = await import('./services/index.js');
    const app = new WebApp({
      services,
      logger: services.logger,
      language: { mode: 'fixed', language: 'zh-CN' },
      proxyIP: { mode: 'detect' },
      mount: [routers('./src/routers')],
    });
    app.http({ keepAliveTimeout: 61_000 }).listen(process.env.PORT || 3000);
  },
});
```

`workers: 'max'` は `os.availableParallelism()` を使う。`Math.min(4, availableParallelism())` で上限をかけてもよい。primary が `SIGINT` / `SIGTERM` を受けると各 worker を `disconnect` し、終了を待つ（タイムアウトで `SIGKILL`）、その後 `process.exit`。

| オプション | 役割 | デフォルト |
| --- | --- | --- |
| `workers` | 数、または `'max'` | （必須） |
| `listen` | **worker のみ**で呼ぶ: App を組み立てて `listen` | （必須） |
| `respawn` | worker が予期せず終了したあと再 `fork` するか | `true` |
| `respawnDelay` | 再 fork 前に待つミリ秒 | `1000` |
| `maxRespawns` | 予期しない再起動の上限。超過で primary は終了コード `1` | 制限なし |
| `shutdownTimeout` | シャットダウン待ち、超過で強制終了 | `5000`（WebApp `shutdown.timeout` と同じ既定） |
| `onListening` / `onExit` | primary で worker の listen / 終了を観察 | — |

::: warning
すでにリバースプロキシ複数インスタンス、systemd 複数 unit、Docker / クラウドマネージドレプリカ、K8s `replicas`、PM2 `-i`、PaaS 水平スケールのいずれかで拡張しているなら、**`clusterListen` を重ねない**。意図的シャットダウンや `disconnect` による終了は respawn しない。予期しない落ちだけが上記ポリシーで再起動する。
:::

## Docker Compose scale

イメージ内は **1 プロセス 1 回の `app.listen`** のまま。レプリカ数は Compose に任せる。同じ `compose.yaml` に Nginx を載せる構成がよくある: 80/443 だけ外に出し、サービス名 `web` にリバースプロキシする——Docker 組み込み DNS は**同名サービスの複数レプリカ**を解決し、下の書き方で Nginx に `3001`/`3002`/`3003` を手書きせず自動ラウンドロビンできる。

```yaml
# compose.yaml
services:
  web:
    build: .
    environment:
      PORT: '3000'
    # 不对外 publish；只进 compose 网络
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
# 本机无 Swarm、临时试副本：
# docker compose up --scale web=3 -d
```

`deploy` は Swarm の意味論。`docker stack deploy`（または互換ツール）で初めてファイルどおりに複数レプリカが立つ。普通の `docker compose up` は `deploy` を**よく無視する**。ローカルで手早く試すなら `--scale web=3` でよい。

Nginx ではサービス名に対して upstream を 1 行書けばよい。Docker DNS は `web` を**その時点の全レプリカのアドレス**に解決する。Nginx が複数 IP を得ればその間でラウンドロビンする——`server` を 3 台分手書きする**必要はない**：

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

注意: OSS の Nginx はデフォルトでホスト名を**起動 / reload 時**に解決し結果をキャッシュする。レプリカが先に立ってから Nginx を起動する（`depends_on: web`）場合、上の書き方でラウンドロビンできる。その後 `scale` でレプリカを増減したら、再解決のため **`nginx -s reload`**（または Nginx コンテナの再起動）が必要。reload しないと peer 一覧は古いままになる。

スケール後に **reload なし**で追従させたい場合は、Docker DNS（`resolver 127.0.0.11`）と変数形式の `proxy_pass`（`set $upstream web; proxy_pass http://$upstream:3000;`）で `valid` 周期に再解決する。多くの同一スタック構成では upstream + スケール後の reload で十分。

WebApp は [proxyIP](/ja/web/) を正しく合わせる。**イメージ入口で `clusterListen` や PM2 `-i` を走らせない**。停止は `SIGTERM` と [グレースフルシャットダウン](/ja/web/#shutdown) に合わせる。

Traefik / Caddy など Docker provider 付きゲートウェイはラベルでレプリカを自動発見でき、`resolver` を手書きしなくてよい。意味は同じ——「同一スタック内リバースプロキシ + 複数レプリカのラウンドロビン」。

## Kubernetes とクラウドマネージド

Docker と同じ考え方: **Pod / タスク内は単一プロセス**、レプリカ数でスケール。

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

プローブと `terminationGracePeriodSeconds` はアプリの `shutdown.timeout` より大きく（少なくともカバーする）こと。さもないとオーケストレータが先に強制終了する。HPA は CPU / カスタム指標で `replicas` を増減、アプリコードは変更不要。

マネージドコンテナ（AWS ECS/Fargate、Google Cloud Run、Azure Container Apps、Alibaba Cloud ACK/SAE など）はレプリカ・ローリング・プローブをコンソールや Terraform に集約: 渡すのは依然 **単一プロセスイメージ**、スケールはプラットフォーム。HashiCorp Nomad なども「job レプリカ × 単一プロセスタスク」の同じモデル。

## PaaS 水平スケール

Fly.io Machines、Render services、Heroku dyno などは「インスタンス数」で拡張。プラットフォームが複数プロセスを起動してトラフィック分散。リポジトリ入口は単一プロセス `listen` のまま、プラットフォームの scale / instances 設定で数を調整すればよく、アプリ内で `fork` しない。

## 次のステップ

- [アプリ入口](/ja/web/): `listen` / `shutdown` / proxyIP
- [レート制限](/ja/plugins/rate-limit): レプリカ複数時は共有 store
- [キャッシュ](/ja/core/cache): session と Redis アダプター