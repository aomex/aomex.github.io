---
outline: deep
---

# Несколько процессов и масштабирование

Когда одного процесса Node не хватает, чтобы загрузить все ядра или выдержать больший QPS, запускают **несколько экземпляров**. Обычно выбирают **один** из подходов ниже — комбинации перемножают число процессов (например PM2 `-i 4` плюс `clusterListen({ workers: 4 })` → 16 рабочих копий приложения).

Сначала разделение ролей:

| Уровень | За что отвечает |
| --- | --- |
| **Кто держит процессы / реплики** | Docker / K8s / PM2 / systemd / managed-хостинг… — сколько поднять, перезапуск, rolling deploy |
| **Что писать в entry приложения** | В большинстве случаев: **в одном процессе один `app.listen`**; `clusterListen` — только если на одной машине встроенный cluster без внешнего менеджера |

In-memory rate limit, memory-кэш и Map в процессе **не** разделяются между процессами. При нескольких репликах счётчики и session — во внешнее хранилище (Redis и т.д.), см. [rate limit](/ru/plugins/rate-limit) и [кэш](/ru/core/cache).

## Как выбрать

| Способ | Когда уместен |
| --- | --- |
| **Обратный прокси + несколько инстансов** | Bare metal / классические VM: несколько портов Node за Nginx / Caddy / HAProxy |
| **systemd** (несколько unit / шаблон) | Одна Linux-машина, те же start/stop и журнал, что у системных сервисов, без отдельного Node-менеджера |
| **PM2 `-i` / `instances`** | Одна VM: управление процессами, логи, reload без простоя |
| **`clusterListen`** | Одна машина / VM, встроенный `cluster` Node, без внешнего менеджера |
| **Docker Compose `scale` / Swarm + Nginx** | Уже в контейнерах; прокси в том же стеке, DNS крутит реплики |
| **K8s `replicas` / HPA** | Прод-оркестрация: rollout, пробы, квоты, autoscale |
| **Управляемые реплики** (ECS/Fargate, Cloud Run, Container Apps…) | Меньше своей control plane; семантика «один процесс в образе × число реплик» |
| **Горизонтальный scale PaaS** (Fly.io, Render, Heroku dyno…) | Платформа расширяет по «числу инстансов»; entry — один listen |

Ниже — по сценариям. Кнопки «реплики / instances» в облачных консолях следуют тем же принципам, что Docker / K8s; команды по вендорам не повторяем.

## Entry в один процесс (общий для большинства схем)

Docker, K8s, managed-хостинг, PaaS, systemd, несколько upstream в Nginx, PM2 `-i` — в entry обычный single-process listen. `CMD` образа, `ExecStart` в systemd, `pm2 start` указывают на этот файл:

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

Остановку согласуйте с [graceful shutdown](/ru/web/#shutdown): оркестратор или менеджер шлёт `SIGTERM`, приложение сливает соединения и выходит.

## Обратный прокси + несколько инстансов

Без оркестрации контейнеров типичная схема: несколько Node на одной или нескольких машинах (разные порты или хосты), спереди Nginx / Caddy / HAProxy.

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

Каждый backend — entry выше (`PORT=3001` / `3002`…). Настройте [proxyIP](/ru/web/) в WebApp, иначе ключи rate limit и аудит увидят адрес прокси, а не клиента. Масштаб = больше процессов и правка upstream; health check и drain — на прокси или в скрипте выката.

## systemd

На Linux приложение можно оформить как системный сервис: автозапуск, рестарт при падении, логи в journal — как у Nginx. Несколько процессов — **несколько unit** или **шаблон** (`aomex@3001`, `aomex@3002`), у каждого свой `PORT`, спереди обратный прокси.

```ini
# фрагмент /etc/systemd/system/aomex@.service
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

`TimeoutStopSec` должен перекрывать `shutdown.timeout` приложения. В **`ExecStart` не вкладывайте** `clusterListen` или PM2.

## PM2

На одной машине без оркестрации, когда нужен привычный Node-менеджер: PM2 поднимает несколько инстансов, логи, `reload` без простоя. Entry остаётся single listen, число инстансов — в `-i`:

```bash
pm2 start dist/main.js -i max
# или ecosystem: instances: 'max' / число, exec_mode: 'cluster'
```

`-i max` — примерно по числу ядер CPU; явное число предсказуемее. Уже используется cluster PM2 — **`clusterListen` не накладывайте**.

## clusterListen

Если не хотите PM2 / несколько unit systemd, но на одной машине нужен встроенный `cluster` Node — `clusterListen` из `@aomex/web`: primary только `fork` и сигналы, **`listen` только в worker**. Сам `WebApp.listen` не меняется, в worker — прежняя цепочка shutdown.

Сборку App и `listen` поместите в callback `listen` (при необходимости `import` services), чтобы primary не гонял бизнес-инициализацию зря:

```typescript
import { clusterListen, routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

clusterListen({ // [!code focus:18]
  workers: 'max', // или число, например 4
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

`workers: 'max'` — `os.availableParallelism()`; можно `Math.min(4, availableParallelism())` для потолка. primary на `SIGINT` / `SIGTERM` делает `disconnect` worker'ам, ждёт выхода (по таймауту `SIGKILL`), затем `process.exit`.

| Опция | Назначение | По умолчанию |
| --- | --- | --- |
| `workers` | число или `'max'` | (обязательно) |
| `listen` | вызывается **только в worker**: собрать App и `listen` | (обязательно) |
| `respawn` | fork снова после неожиданного падения worker | `true` |
| `respawnDelay` | пауза перед повторным fork (мс) | `1000` |
| `maxRespawns` | лимит «случайных» подъёмов; при превышении primary выходит с кодом `1` | без лимита |
| `shutdownTimeout` | сколько ждать остановки, затем kill | `5000` (как `shutdown.timeout` WebApp) |
| `onListening` / `onExit` | на primary наблюдать listen / выход worker | — |

::: warning
Уже есть обратный прокси с несколькими инстансами, несколько unit systemd, реплики Docker / managed, K8s `replicas`, PM2 `-i` или горизонтальный scale PaaS — **`clusterListen` не добавляйте**. Плановый shutdown и выход из‑за `disconnect` не respawn'ятся; только неожиданный краш — по политике выше.
:::

## Docker Compose scale

В образе по-прежнему **один процесс, один `app.listen`**; реплики задаёт Compose. В том же `compose.yaml` часто Nginx: наружу 80/443, прокси на имя сервиса `web` — встроенный DNS Docker резолвит **все реплики одноимённого сервиса**, при конфигурации ниже получается round-robin без ручного `3001`/`3002`/`3003` в Nginx.

```yaml
# compose.yaml
services:
  web:
    build: .
    environment:
      PORT: '3000'
    # без publish наружу; только сеть compose
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
# локально без Swarm, попробовать реплики:
# docker compose up --scale web=3 -d
```

`deploy` — семантика Swarm: несколько реплик по файлу даёт `docker stack deploy` (или совместимый инструмент). Обычный `docker compose up` **часто игнорирует** `deploy`, временно — `--scale web=3`.

В Nginx достаточно одной строки upstream с именем сервиса. DNS Docker отдаёт **все адреса реплик** `web`; несколько IP — round-robin между ними, **без** трёх ручных `server`.

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

Важно: OSS Nginx по умолчанию резолвит имена при **старте / reload** и кэширует. Если Nginx поднимается после реплик (`depends_on: web`), round-robin работает. После `scale` нужен **`nginx -s reload`** (или рестарт контейнера Nginx), иначе список peer устареет.

Чтобы после scale **без reload** подхватывать новые адреса — DNS Docker (`resolver 127.0.0.11`) и `proxy_pass` через переменную (`set $upstream web; proxy_pass http://$upstream:3000;`) с периодом `valid`. Для многих стеков хватает upstream + reload после scale.

WebApp: корректный [proxyIP](/ru/web/). **Не** запускайте в entry образа `clusterListen` или PM2 `-i`. Остановка — `SIGTERM` и [graceful shutdown](/ru/web/#shutdown).

Traefik / Caddy с Docker provider часто находят реплики по labels и при scale обходятся без ручного reload Nginx.

## Kubernetes и managed-хостинг

Та же логика, что у Docker: **в Pod / задаче один процесс**, масштаб — числом реплик.

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

Пробы и `terminationGracePeriodSeconds` должны быть больше (или как минимум покрывать) `shutdown.timeout` приложения, иначе оркестратор убьёт раньше. HPA меняет `replicas` по CPU / своим метрикам без правок кода.

Managed-контейнеры (ECS/Fargate, Cloud Run, Container Apps, ACK/SAE и т.д.) забирают реплики, rollout и пробы в консоль или Terraform: вы поставляете **образ с одним процессом**, scale — платформе. Nomad и аналоги — та же модель «реплики job × одна задача-процесс».

## Горизонтальный scale PaaS

Fly.io Machines, Render, Heroku dynos расширяют по «числу инстансов». Платформа поднимает процессы и раздаёт трафик; в репозитории — single listen, количество — в scale / instances документации платформы, без `fork` в приложении.

## Дальше

- [Точка входа приложения](/ru/web/): `listen` / `shutdown` / proxyIP
- [Rate limit](/ru/plugins/rate-limit): при репликах — общий store
- [Кэш](/ru/core/cache): session и Redis-адаптер