---
outline: deep
---

# 多程序與擴容

單程序吃不滿多核、或想扛更高 QPS 時，會用到「多份 Node」。常見幾條路**只選一條**——疊著用會把程序數乘起來（例如 PM2 `-i 4` 再套 `clusterListen({ workers: 4 })` → 16 份業務）。

先認清兩層分工：

| 層 | 幹什麼 |
| --- | --- |
| **程序 / 副本誰來管** | Docker / K8s / PM2 / systemd / 雲託管… 負責起幾份、掛了拉起、滾動釋出 |
| **應用入口寫什麼** | 絕大多數情況：**一份程序裡只 `app.listen` 一次**；只有「單機自帶 cluster、不另裝管理器」才用 `clusterListen` |

記憶體限流、memory 快取、程序內 Map **不會**跨程序共享——多副本時計數與 session 要換 Redis 等外接儲存，見 [限流](/zh-TW/plugins/rate-limit) · [快取](/zh-TW/core/cache)。

## 怎麼選

| 方式 | 適合什麼 |
| --- | --- |
| **反向代理 + 多實例** | 裸機 / 傳統 VM：Nginx / Caddy / HAProxy 後面掛多個 Node 埠 |
| **systemd**（多 unit / 模板） | Linux 單機，想跟系統服務同一套啟停與日誌，不用 Node 專用程序管理器 |
| **PM2 `-i` / `instances`** | 單機 VM，要程序管理、日誌聚合、零停機過載 |
| **`clusterListen`** | 單機 / VM，用 Node 自帶 `cluster`，不另裝程序管理器 |
| **Docker Compose `scale` / Swarm + Nginx** | 已容器化；同棧反代，DNS 自動輪詢副本 |
| **K8s `replicas` / HPA** | 生產編排：滾動、探針、配額、自動擴縮 |
| **雲託管副本**（ECS/Fargate、Cloud Run、Container Apps…） | 要託管編排、少自建控制面；語義仍是「映象內單程序 × 副本」 |
| **PaaS 橫向擴充套件**（Fly.io、Render、Heroku dyno…） | 平臺按「實例數」擴；入口仍是單程序 listen |

下面按場景展開。雲廠商控制台點「副本 / instances」的，寫法與 Docker / K8s 同一原則，不再逐家複述命令。

## 單程序入口（多數方案共用）

Docker、K8s、雲託管、PaaS、systemd、Nginx 多 upstream、PM2 `-i`——入口檔案都是普通單程序 listen。映象 `CMD`、systemd `ExecStart`、`pm2 start` 指向這份即可：

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

關停對接 [優雅關停](/zh-TW/web/#shutdown)：編排或程序管理器發 `SIGTERM`，應用排空連線後再退出。

## 反向代理 + 多實例

不引入容器編排時，最常見的業界做法：同一臺或幾臺機器上起多個 Node（不同埠或不同主機），前面用 Nginx / Caddy / HAProxy 做負載均衡。

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

每個後端仍是上面的單程序入口（`PORT=3001` / `3002`…）。WebApp 要配準 [proxyIP](/zh-TW/web/)，否則限流鍵、審計日誌會看到代理地址而不是客戶端。擴容 = 多起幾個程序並改 upstream；健康檢查、連線排空由代理或釋出指令碼負責。

## systemd

Linux 上可以把應用註冊成系統服務：開機自啟、崩潰重啟、journal 日誌，和 Nginx 同一套運維習慣。多程序時用**多個 unit** 或 **模板 unit**（`aomex@3001`、`aomex@3002`），每個實例一個 `PORT`，前面仍掛反向代理。

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

`TimeoutStopSec` 要蓋住應用 `shutdown.timeout`。這裡**不要**再在 `ExecStart` 裡套 `clusterListen` 或 PM2。

## PM2

單機沒上編排、又想要 Node 生態裡現成的程序管理時，用 PM2：拉起多實例、日誌、`reload` 零停機過載。入口保持單程序 listen，實例數交給 `-i`：

```bash
pm2 start dist/main.js -i max
# 或 ecosystem：instances: 'max' / 数字，exec_mode: 'cluster'
```

`-i max` 大致按 CPU 核數；寫成數字更可控。這裡已經用了 PM2 的 cluster 模式，**不要**再套 `clusterListen`。

## clusterListen

不想裝 PM2 / systemd 多 unit、又要在一臺機器上用 Node 自帶 `cluster` 時，用 `@aomex/web` 的 `clusterListen`：primary 只負責 `fork` / 收訊號，**真正 `listen` 只在 worker 裡跑**。不改 `WebApp.listen` 本身，worker 裡仍走原來的關停鏈路。

把建 App、`listen` 放進 `listen` 回撥（需要時再 `import` services），避免 primary 白跑一遍業務初始化：

```typescript
import { clusterListen, routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

clusterListen({ // [!code focus:18]
  workers: 'max', // 或具体数字，如 4
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

`workers: 'max'` 用 `os.availableParallelism()`；也可以寫成 `Math.min(4, availableParallelism())` 先封頂。primary 收到 `SIGINT` / `SIGTERM` 時會 `disconnect` 各 worker，等它們退出（超時 `SIGKILL`），再 `process.exit`。

| 選項 | 幹什麼 | 預設 |
| --- | --- | --- |
| `workers` | 數量，或 `'max'` | （必填） |
| `listen` | **僅 worker** 裡呼叫：建 App 並 `listen` | （必填） |
| `respawn` | worker 意外退出後是否再 `fork` | `true` |
| `respawnDelay` | 再 fork 前等多少毫秒 | `1000` |
| `maxRespawns` | 意外拉起次數上限；超限 primary 以碼 `1` 關機 | 不限制 |
| `shutdownTimeout` | 關機等多久，超時強殺 | `5000`（與 WebApp `shutdown.timeout` 預設一致） |
| `onListening` / `onExit` | primary 上觀察 worker 監聽 / 退出 | — |

::: warning
已經用反向代理多實例、systemd 多 unit、Docker / 雲託管副本、K8s `replicas`、PM2 `-i` 或 PaaS 橫向擴充套件時，**不要再**套 `clusterListen`。主動關機、`disconnect` 導致的退出不會 respawn；只有意外掛掉才會按上面的策略拉起。
:::

## Docker Compose scale

映象裡仍是**一個程序一個 `app.listen`**，副本數交給 Compose。同一份 `compose.yaml` 裡常再掛一個 Nginx：只暴露 80/443，反代到服務名 `web`——Docker 內建 DNS 會對**同名服務的多個副本**做解析，配合下面的寫法即可自動輪詢，不必在 Nginx 裡手寫 `3001`/`3002`/`3003`。

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

`deploy` 是 Swarm 語義：`docker stack deploy`（或相容工具）才按檔案起多副本。普通 `docker compose up` **常會忽略** `deploy`，可用 `--scale web=3` 臨時指定。

Nginx 裡對服務名寫一條 upstream 即可。Docker DNS 會把 `web` 解析成**當時所有副本的地址**；Nginx 若解析到多個 IP，會在這些地址間輪詢——**不必**手寫三臺 `server`：

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

注意：開源 Nginx 預設在**啟動 / reload 時**解析主機名並快取結果。副本已經起來再啟 Nginx（`depends_on: web`）時，上面這種寫法就能輪詢。之後若又 `scale` 加減副本，需要 **`nginx -s reload`**（或重啟 Nginx 容器）讓它重新解析；不 reload 的話 peer 列表仍是舊的。

若希望擴縮後**不 reload**也能跟上，再用 Docker DNS（`resolver 127.0.0.11`）+ 變數形式的 `proxy_pass`（`set $upstream web; proxy_pass http://$upstream:3000;`），按 `valid` 週期重新解析。多數同棧部署用 upstream + 擴縮後 reload 就夠。

WebApp 仍要配準 [proxyIP](/zh-TW/web/)。**不要**在映象入口再跑 `clusterListen` 或 PM2 `-i`。關停對接 `SIGTERM` 與 [優雅關停](/zh-TW/web/#shutdown)。

Traefik / Caddy 等帶 Docker provider 的閘道器可以按標籤發現副本，擴縮時往往不用手 reload Nginx。

## Kubernetes 與雲託管

和 Docker 同一思路：**Pod / 任務內單程序**，用副本數擴縮。

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

探針、`terminationGracePeriodSeconds` 要大於（或至少覆蓋）應用 `shutdown.timeout`，否則編排會先強殺。HPA 按 CPU / 自定義指標加減 `replicas`，應用程式碼不用改。

託管容器服務（AWS ECS/Fargate、Google Cloud Run、Azure Container Apps、阿里雲 ACK/SAE 等）把「副本、滾動、探針」收進控制台或 Terraform：你仍交付**單程序映象**，擴縮交給平臺。HashiCorp Nomad 等排程器也是「job 副本 × 單程序任務」同一模型。

## PaaS 橫向擴充套件

Fly.io Machines、Render services、Heroku dynos 等按「實例數」擴。平臺替你起多份程序並做流量分發；倉庫入口保持單程序 `listen`，用平臺文件裡的 scale / instances 配置調數量即可，不必在應用裡再 `fork`。

## 下一步

- [應用入口](/zh-TW/web/)：`listen` / `shutdown` / proxyIP
- [限流](/zh-TW/plugins/rate-limit)：多副本換共享 store
- [快取](/zh-TW/core/cache)：session 與 Redis 適配器
