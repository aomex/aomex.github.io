---
outline: deep
---

# 多进程与扩容

单进程吃不满多核、或想扛更高 QPS 时，会用到「多份 Node」。常见几条路**只选一条**——叠着用会把进程数乘起来（例如 PM2 `-i 4` 再套 `clusterListen({ workers: 4 })` → 16 份业务）。

先认清两层分工：

| 层 | 干什么 |
| --- | --- |
| **进程 / 副本谁来管** | Docker / K8s / PM2 / systemd / 云托管… 负责起几份、挂了拉起、滚动发布 |
| **应用入口写什么** | 绝大多数情况：**一份进程里只 `app.listen` 一次**；只有「单机自带 cluster、不另装管理器」才用 `clusterListen` |

内存限流、memory 缓存、进程内 Map **不会**跨进程共享——多副本时计数与 session 要换 Redis 等外置存储，见 [限流](/zh/plugins/rate-limit) · [缓存](/zh/core/cache)。

## 怎么选

| 方式 | 适合什么 |
| --- | --- |
| **反向代理 + 多实例** | 裸机 / 传统 VM：Nginx / Caddy / HAProxy 后面挂多个 Node 端口 |
| **systemd**（多 unit / 模板） | Linux 单机，想跟系统服务同一套启停与日志，不用 Node 专用进程管理器 |
| **PM2 `-i` / `instances`** | 单机 VM，要进程管理、日志聚合、零停机重载 |
| **`clusterListen`** | 单机 / VM，用 Node 自带 `cluster`，不另装进程管理器 |
| **Docker Compose `scale` / Swarm + Nginx** | 已容器化；同栈反代，DNS 自动轮询副本 |
| **K8s `replicas` / HPA** | 生产编排：滚动、探针、配额、自动扩缩 |
| **云托管副本**（ECS/Fargate、Cloud Run、Container Apps…） | 要托管编排、少自建控制面；语义仍是「镜像内单进程 × 副本」 |
| **PaaS 横向扩展**（Fly.io、Render、Heroku dyno…） | 平台按「实例数」扩；入口仍是单进程 listen |

下面按场景展开。云厂商控制台点「副本 / instances」的，写法与 Docker / K8s 同一原则，不再逐家复述命令。

## 单进程入口（多数方案共用）

Docker、K8s、云托管、PaaS、systemd、Nginx 多 upstream、PM2 `-i`——入口文件都是普通单进程 listen。镜像 `CMD`、systemd `ExecStart`、`pm2 start` 指向这份即可：

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

关停对接 [优雅关停](/zh/web/#shutdown)：编排或进程管理器发 `SIGTERM`，应用排空连接后再退出。

## 反向代理 + 多实例

不引入容器编排时，最常见的业界做法：同一台或几台机器上起多个 Node（不同端口或不同主机），前面用 Nginx / Caddy / HAProxy 做负载均衡。

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

每个后端仍是上面的单进程入口（`PORT=3001` / `3002`…）。WebApp 要配准 [proxyIP](/zh/web/)，否则限流键、审计日志会看到代理地址而不是客户端。扩容 = 多起几个进程并改 upstream；健康检查、连接排空由代理或发布脚本负责。

## systemd

Linux 上可以把应用注册成系统服务：开机自启、崩溃重启、journal 日志，和 Nginx 同一套运维习惯。多进程时用**多个 unit** 或 **模板 unit**（`aomex@3001`、`aomex@3002`），每个实例一个 `PORT`，前面仍挂反向代理。

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

`TimeoutStopSec` 要盖住应用 `shutdown.timeout`。这里**不要**再在 `ExecStart` 里套 `clusterListen` 或 PM2。

## PM2

单机没上编排、又想要 Node 生态里现成的进程管理时，用 PM2：拉起多实例、日志、`reload` 零停机重载。入口保持单进程 listen，实例数交给 `-i`：

```bash
pm2 start dist/main.js -i max
# 或 ecosystem：instances: 'max' / 数字，exec_mode: 'cluster'
```

`-i max` 大致按 CPU 核数；写成数字更可控。这里已经用了 PM2 的 cluster 模式，**不要**再套 `clusterListen`。

## clusterListen

不想装 PM2 / systemd 多 unit、又要在一台机器上用 Node 自带 `cluster` 时，用 `@aomex/web` 的 `clusterListen`：primary 只负责 `fork` / 收信号，**真正 `listen` 只在 worker 里跑**。不改 `WebApp.listen` 本身，worker 里仍走原来的关停链路。

把建 App、`listen` 放进 `listen` 回调（需要时再 `import` services），避免 primary 白跑一遍业务初始化：

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

`workers: 'max'` 用 `os.availableParallelism()`；也可以写成 `Math.min(4, availableParallelism())` 先封顶。primary 收到 `SIGINT` / `SIGTERM` 时会 `disconnect` 各 worker，等它们退出（超时 `SIGKILL`），再 `process.exit`。

| 选项 | 干什么 | 默认 |
| --- | --- | --- |
| `workers` | 数量，或 `'max'` | （必填） |
| `listen` | **仅 worker** 里调用：建 App 并 `listen` | （必填） |
| `respawn` | worker 意外退出后是否再 `fork` | `true` |
| `respawnDelay` | 再 fork 前等多少毫秒 | `1000` |
| `maxRespawns` | 意外拉起次数上限；超限 primary 以码 `1` 关机 | 不限制 |
| `shutdownTimeout` | 关机等多久，超时强杀 | `5000`（与 WebApp `shutdown.timeout` 默认一致） |
| `onListening` / `onExit` | primary 上观察 worker 监听 / 退出 | — |

::: warning
已经用反向代理多实例、systemd 多 unit、Docker / 云托管副本、K8s `replicas`、PM2 `-i` 或 PaaS 横向扩展时，**不要再**套 `clusterListen`。主动关机、`disconnect` 导致的退出不会 respawn；只有意外挂掉才会按上面的策略拉起。
:::

## Docker Compose scale

镜像里仍是**一个进程一个 `app.listen`**，副本数交给 Compose。同一份 `compose.yaml` 里常再挂一个 Nginx：只暴露 80/443，反代到服务名 `web`——Docker 内置 DNS 会对**同名服务的多个副本**做解析，配合下面的写法即可自动轮询，不必在 Nginx 里手写 `3001`/`3002`/`3003`。

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

`deploy` 是 Swarm 语义：`docker stack deploy`（或兼容工具）才按文件起多副本。普通 `docker compose up` **常会忽略** `deploy`，可用 `--scale web=3` 临时指定。

Nginx 里对服务名写一条 upstream 即可。Docker DNS 会把 `web` 解析成**当时所有副本的地址**；Nginx 若解析到多个 IP，会在这些地址间轮询——**不必**手写三台 `server`：

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

注意：开源 Nginx 默认在**启动 / reload 时**解析主机名并缓存结果。副本已经起来再启 Nginx（`depends_on: web`）时，上面这种写法就能轮询。之后若又 `scale` 加减副本，需要 **`nginx -s reload`**（或重启 Nginx 容器）让它重新解析；不 reload 的话 peer 列表仍是旧的。

若希望扩缩后**不 reload**也能跟上，再用 Docker DNS（`resolver 127.0.0.11`）+ 变量形式的 `proxy_pass`（`set $upstream web; proxy_pass http://$upstream:3000;`），按 `valid` 周期重新解析。多数同栈部署用 upstream + 扩缩后 reload 就够。

WebApp 仍要配准 [proxyIP](/zh/web/)。**不要**在镜像入口再跑 `clusterListen` 或 PM2 `-i`。关停对接 `SIGTERM` 与 [优雅关停](/zh/web/#shutdown)。

Traefik / Caddy 等带 Docker provider 的网关可以按标签发现副本，扩缩时往往不用手 reload Nginx。

## Kubernetes 与云托管

和 Docker 同一思路：**Pod / 任务内单进程**，用副本数扩缩。

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

探针、`terminationGracePeriodSeconds` 要大于（或至少覆盖）应用 `shutdown.timeout`，否则编排会先强杀。HPA 按 CPU / 自定义指标加减 `replicas`，应用代码不用改。

托管容器服务（AWS ECS/Fargate、Google Cloud Run、Azure Container Apps、阿里云 ACK/SAE 等）把「副本、滚动、探针」收进控制台或 Terraform：你仍交付**单进程镜像**，扩缩交给平台。HashiCorp Nomad 等调度器也是「job 副本 × 单进程任务」同一模型。

## PaaS 横向扩展

Fly.io Machines、Render services、Heroku dynos 等按「实例数」扩。平台替你起多份进程并做流量分发；仓库入口保持单进程 `listen`，用平台文档里的 scale / instances 配置调数量即可，不必在应用里再 `fork`。

## 下一步

- [应用入口](/zh/web/)：`listen` / `shutdown` / proxyIP
- [限流](/zh/plugins/rate-limit)：多副本换共享 store
- [缓存](/zh/core/cache)：session 与 Redis 适配器
