---
outline: deep
---

# Multi-process and scaling

When a single process cannot use all cores or you need higher QPS, you run multiple Node processes. Pick **one** of the common paths—stacking them multiplies process count (e.g. PM2 `-i 4` plus `clusterListen({ workers: 4 })` → 16 app processes).

First, understand the two layers:

| Layer | Role |
| --- | --- |
| **Who manages processes / replicas** | Docker / K8s / PM2 / systemd / managed cloud… start N copies, restart on crash, rolling deploy |
| **What the app entry does** | In most cases: **one `app.listen` per process**; use `clusterListen` only when you rely on Node’s built-in cluster on one machine without another process manager |

In-memory rate limits, memory cache, and in-process `Map`s **do not** share across processes—with multiple replicas, use Redis or similar for counts and sessions. See [Rate limiting](/en/plugins/rate-limit) · [Cache](/en/core/cache).

## How to choose

| Approach | Good for |
| --- | --- |
| **Reverse proxy + multiple instances** | Bare metal / traditional VMs: Nginx / Caddy / HAProxy in front of several Node ports |
| **systemd** (multiple units / template) | Linux single host: same start/stop and logging as system services, without a Node-specific process manager |
| **PM2 `-i` / `instances`** | Single VM: process management, log aggregation, zero-downtime reload |
| **`clusterListen`** | Single machine / VM: Node built-in `cluster`, no extra process manager |
| **Docker Compose `scale` / Swarm + Nginx** | Already containerized; in-stack reverse proxy, DNS auto round-robins replicas |
| **K8s `replicas` / HPA** | Production orchestration: rolling updates, probes, quotas, autoscaling |
| **Managed cloud replicas** (ECS/Fargate, Cloud Run, Container Apps…) | Managed orchestration with less control-plane work; still “single process in image × replicas” |
| **PaaS horizontal scaling** (Fly.io, Render, Heroku dyno…) | Platform scales by “instance count”; entry still single-process `listen` |

The sections below walk through each scenario. Cloud consoles that expose “replicas / instances” follow the same principles as Docker / K8s; vendor-specific commands are not repeated one by one.

## Single-process entry (shared by most setups)

Docker, K8s, managed cloud, PaaS, systemd, Nginx multi-upstream, PM2 `-i`—all use the same ordinary single-process listen entry. Point image `CMD`, systemd `ExecStart`, and `pm2 start` at this file:

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

Shutdown ties to [graceful shutdown](/en/web/#shutdown): orchestrator or process manager sends `SIGTERM`; the app drains connections then exits.

## Reverse proxy + multiple instances

Without container orchestration, the usual pattern: run several Node processes (different ports or hosts) behind Nginx / Caddy / HAProxy for load balancing.

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

Each backend still uses the single-process entry above (`PORT=3001` / `3002`…). Configure [proxyIP](/en/web/) on WebApp, or rate-limit keys and audit logs will show the proxy instead of the client. Scaling means more processes and upstream edits; health checks and connection draining are handled by the proxy or your deploy scripts.

## systemd

On Linux you can register the app as a system service: boot start, crash restart, journal logs—the same ops habit as Nginx. For multiple processes, use **multiple units** or a **template unit** (`aomex@3001`, `aomex@3002`), one `PORT` per instance, with a reverse proxy in front.

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

`TimeoutStopSec` should cover the app’s `shutdown.timeout`. **Do not** wrap `clusterListen` or PM2 inside `ExecStart` here.

## PM2

On a single host without orchestration, PM2 gives you process management, logs, and zero-downtime `reload`. Keep a single-process listen entry and let `-i` control instance count:

```bash
pm2 start dist/main.js -i max
# 或 ecosystem：instances: 'max' / 数字，exec_mode: 'cluster'
```

`-i max` roughly follows CPU core count; a fixed number is easier to reason about. PM2 cluster mode is already in use—**do not** add `clusterListen` on top.

## clusterListen

When you do not want PM2 or multiple systemd units but still want Node’s built-in `cluster` on one machine, use `clusterListen` from `@aomex/web`: the primary only `fork`s and handles signals; **real `listen` runs only in workers**. `WebApp.listen` stays unchanged; workers still use the normal shutdown path.

Put app construction and `listen` inside the `listen` callback (lazy-`import` services when needed) so the primary does not run business initialization for nothing:

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

`workers: 'max'` uses `os.availableParallelism()`; you can cap with e.g. `Math.min(4, availableParallelism())`. On `SIGINT` / `SIGTERM`, the primary `disconnect`s workers, waits for exit (then `SIGKILL` on timeout), then `process.exit`.

| Option | Role | Default |
| --- | --- | --- |
| `workers` | Count, or `'max'` | (required) |
| `listen` | Called **only in workers**: build app and `listen` | (required) |
| `respawn` | Re-`fork` after unexpected worker exit | `true` |
| `respawnDelay` | Milliseconds to wait before fork again | `1000` |
| `maxRespawns` | Cap on unexpected respawns; primary exits with code `1` if exceeded | unlimited |
| `shutdownTimeout` | How long to wait on shutdown before force kill | `5000` (same default as WebApp `shutdown.timeout`) |
| `onListening` / `onExit` | Observe worker listen / exit on primary | — |

::: warning
If you already scale with reverse proxy instances, multiple systemd units, Docker / managed cloud replicas, K8s `replicas`, PM2 `-i`, or PaaS horizontal scaling, **do not** add `clusterListen`. Intentional shutdown and exits from `disconnect` are not respawned; only unexpected crashes follow the respawn policy above.
:::

## Docker Compose scale

The image still runs **one process with one `app.listen`**; replica count is up to Compose. A common pattern in the same `compose.yaml` is to add Nginx: expose only 80/443 and reverse-proxy to the service name `web`—Docker’s built-in DNS resolves **multiple replicas of the same service name**, and with the config below you get automatic round-robin without hand-writing `3001`/`3002`/`3003` in Nginx.

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

`deploy` is Swarm semantics: only `docker stack deploy` (or compatible tools) starts multiple replicas from the file. Plain `docker compose up` often **ignores** `deploy`; use `--scale web=3` for a quick local test.

In Nginx, one upstream entry for the service name is enough. Docker DNS resolves `web` to **all replica addresses at that time**; when Nginx gets multiple IPs, it round-robins among them—you do **not** need to hand-write three `server` lines:

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

Note: open-source Nginx resolves hostnames at **startup / reload** by default and caches the result. When replicas are already up before Nginx starts (`depends_on: web`), the config above round-robins correctly. After a later `scale` up or down, run **`nginx -s reload`** (or restart the Nginx container) so it re-resolves; without reload, the peer list stays stale.

If you want scaling to follow **without reload**, use Docker DNS (`resolver 127.0.0.11`) plus variable `proxy_pass` (`set $upstream web; proxy_pass http://$upstream:3000;`) and re-resolve on the `valid` interval. For most in-stack deploys, upstream plus reload after scale is enough.

WebApp still needs [proxyIP](/en/web/) configured correctly. **Do not** run `clusterListen` or PM2 `-i` in the image entrypoint. Shutdown is `SIGTERM` tied to [graceful shutdown](/en/web/#shutdown).

Traefik / Caddy with a Docker provider can discover replicas via labels without hand-writing `resolver`; same idea—in-stack reverse proxy with multi-replica round-robin.

## Kubernetes and managed cloud

Same idea as Docker: **one process per Pod / task**, scale with replica count.

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

Probes and `terminationGracePeriodSeconds` should be greater than (or at least cover) the app’s `shutdown.timeout`, or the orchestrator may kill the Pod first. HPA adds or removes `replicas` by CPU or custom metrics; app code stays unchanged.

Managed container services (AWS ECS/Fargate, Google Cloud Run, Azure Container Apps, Alibaba Cloud ACK/SAE, etc.) fold replicas, rolling updates, and probes into console or Terraform: you still ship a **single-process image** and let the platform scale. Schedulers like HashiCorp Nomad use the same model—job replicas × single-process task.

## PaaS horizontal scaling

Fly.io Machines, Render services, Heroku dynos, and similar scale by “instance count”. The platform starts multiple processes and routes traffic; keep a single-process `listen` entry in the repo and adjust count via the platform’s scale / instances settings—no in-app `fork`.

## Next steps

- [App entry](/en/web/): `listen` / `shutdown` / proxyIP
- [Rate limiting](/en/plugins/rate-limit): shared store with multiple replicas
- [Cache](/en/core/cache): sessions and Redis adapters