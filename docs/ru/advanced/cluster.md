---
outline: deep
---

# Несколько процессов и масштабирование

Когда одного процесса мало для всех ядер или нужен больший QPS, запускают несколько процессов Node. Из типичных путей **выбирают один** — наложение перемножает число процессов (например PM2 `-i 4` плюс `clusterListen({ workers: 4 })` → 16 рабочих процессов).

Сначала разделение на два уровня:

| Уровень | Задача |
| --- | --- |
| **Кто управляет процессами / репликами** | Docker / K8s / PM2 / systemd / управляемый облачный сервис… — сколько поднять, перезапуск при падении, rolling deploy |
| **Что писать во входе приложения** | В большинстве случаев: **один `app.listen` на процесс**; `clusterListen` — только если на одной машине используете встроенный `cluster` Node без отдельного менеджера процессов |

Лимиты в памяти, memory-кэш и in-process `Map` **не** разделяются между процессами — при нескольких репликах счётчики и session переносят в Redis и т.п. См. [Rate limiting](/ru/plugins/rate-limit) · [Кэш](/ru/core/cache).

## Как выбрать

| Способ | Когда подходит |
| --- | --- |
| **Обратный прокси + несколько инстансов** | Bare metal / классические VM: Nginx / Caddy / HAProxy перед несколькими портами Node |
| **systemd** (несколько unit / шаблон) | Linux на одном хосте: те же start/stop и логи, что у системных сервисов, без Node-менеджера |
| **PM2 `-i` / `instances`** | Одна VM: менеджер процессов, агрегация логов, reload без простоя |
| **`clusterListen`** | Одна машина / VM: встроенный `cluster` Node, без доп. менеджера |
| **Docker Compose `scale` / Swarm + Nginx** | Уже в контейнерах; обратный прокси в том же стеке, DNS автоматически round-robin по репликам |
| **K8s `replicas` / HPA** | Продакшен-оркестрация: rolling, пробы, квоты, автоскейл |
| **Управляемые реплики в облаке** (ECS/Fargate, Cloud Run, Container Apps…) | Меньше своего control plane; семантика та же: «один процесс в образе × реплики» |
| **Горизонтальное масштабирование PaaS** (Fly.io, Render, Heroku dyno…) | Платформа масштабирует по «числу инстансов»; вход по-прежнему single-process `listen` |

Ниже — по сценариям. Консоли облаков с «replicas / instances» следуют тем же принципам, что Docker / K8s; команды по вендорам не перечисляются.

## Вход с одним процессом (общий для большинства схем)

Docker, K8s, managed cloud, PaaS, systemd, несколько upstream в Nginx, PM2 `-i` — везде один и тот же обычный single-process listen. На этот файл указывают `CMD` образа, `ExecStart` в systemd и `pm2 start`:

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

Остановка стыкуется с [graceful shutdown](/ru/web/#shutdown): оркестратор или менеджер шлёт `SIGTERM`, приложение сливает соединения и выходит.

## Обратный прокси + несколько инстансов

Без оркестрации контейнеров обычный вариант: несколько Node (разные порты или хосты), спереди Nginx / Caddy / HAProxy для балансировки.

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

Каждый backend — тот же single-process вход (`PORT=3001` / `3002`…). Настройте [proxyIP](/ru/web/) в WebApp, иначе ключи лимитов и audit-логи увидят прокси, а не клиента. Масштаб = больше процессов и правка upstream; health check и слив соединений — на прокси или в скриптах деплоя.

## systemd

На Linux приложение можно оформить как системный сервис: автозапуск, перезапуск при сбое, journal — те же привычки, что с Nginx. Несколько процессов — **несколько unit** или **шаблонный unit** (`aomex@3001`, `aomex@3002`), у каждого свой `PORT`, спереди обратный прокси.

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

`TimeoutStopSec` должен покрывать `shutdown.timeout` приложения. В `ExecStart` **не** оборачивайте `clusterListen` или PM2.

## PM2

На одном хосте без оркестрации PM2 даёт менеджмент процессов, логи и `reload` без простоя. Вход — single-process listen, число инстансов — у `-i`:

```bash
pm2 start dist/main.js -i max
# 或 ecosystem：instances: 'max' / 数字，exec_mode: 'cluster'
```

`-i max` ориентировочно по числу ядер CPU; фиксированное число проще контролировать. Уже используется cluster-режим PM2 — **`clusterListen` не добавляйте**.

## clusterListen

Если не хотите PM2 или несколько systemd unit, но нужен встроенный `cluster` Node на одной машине — `clusterListen` из `@aomex/web`: primary только `fork` и сигналы; **реальный `listen` только в worker**. Сам `WebApp.listen` не меняется, в worker — прежняя цепочка shutdown.

Сборку App и `listen` поместите в колбэк `listen` (при необходимости lazy-`import` services), чтобы primary не гонял бизнес-инициализацию впустую:

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

`workers: 'max'` использует `os.availableParallelism()`; можно ограничить, например `Math.min(4, availableParallelism())`. По `SIGINT` / `SIGTERM` primary делает `disconnect` worker'ам, ждёт выхода (при таймауте — `SIGKILL`), затем `process.exit`.

| Опция | Назначение | По умолчанию |
| --- | --- | --- |
| `workers` | Число или `'max'` | (обязательно) |
| `listen` | Вызывается **только в worker**: создать App и `listen` | (обязательно) |
| `respawn` | Снова `fork` после неожиданного выхода worker | `true` |
| `respawnDelay` | Мс ожидания перед повторным fork | `1000` |
| `maxRespawns` | Лимит неожиданных перезапусков; при превышении primary выходит с кодом `1` | без лимита |
| `shutdownTimeout` | Сколько ждать shutdown, затем kill | `5000` (как у WebApp `shutdown.timeout`) |
| `onListening` / `onExit` | Наблюдение за listen / выходом worker на primary | — |

::: warning
Если вы уже масштабируетесь через несколько инстансов за прокси, несколько systemd unit, реплики Docker / managed cloud, K8s `replicas`, PM2 `-i` или горизонтальное масштабирование PaaS — **`clusterListen` не накладывайте**. Плановый shutdown и выход из-за `disconnect` не respawn'ятся; по политике выше поднимаются только неожиданные падения.
:::

## Docker Compose scale

В образе по-прежнему **один процесс с одним `app.listen`**; число реплик — у Compose. В том же `compose.yaml` часто добавляют Nginx: наружу только 80/443, обратный прокси на имя сервиса `web` — встроенный DNS Docker разрешает **несколько реплик одного имени сервиса**, а с конфигом ниже получается автоматический round-robin без ручного перечисления `3001`/`3002`/`3003` в Nginx.

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

`deploy` — семантика Swarm: несколько реплик по файлу поднимает `docker stack deploy` (или совместимый инструмент). Обычный `docker compose up` **часто игнорирует** `deploy`; для быстрой локальной проверки укажите `--scale web=3`.

В Nginx достаточно одной строки upstream для имени сервиса. Docker DNS резолвит `web` в **все адреса реплик на данный момент**; если Nginx получает несколько IP, он round-robin между ними — **не** нужно вручную прописывать три `server`:

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

Замечание: в open-source Nginx по умолчанию имена хостов резолвятся при **старте / reload** и кэшируются. Если реплики уже подняты до старта Nginx (`depends_on: web`), конфиг выше даёт round-robin. После последующего `scale` вверх или вниз нужны **`nginx -s reload`** (или перезапуск контейнера Nginx), чтобы заново резолвить; без reload список peer остаётся старым.

Если нужно подхватывать масштабирование **без reload**, используйте DNS Docker (`resolver 127.0.0.11`) и `proxy_pass` через переменную (`set $upstream web; proxy_pass http://$upstream:3000;`) с повторным resolve по интервалу `valid`. Для большинства развёртываний в одном стеке хватает upstream и reload после scale.

У WebApp по-прежнему должен быть настроен [proxyIP](/ru/web/). **Не** запускайте в entrypoint образа `clusterListen` или PM2 `-i`. Остановка — `SIGTERM` в связке с [graceful shutdown](/ru/web/#shutdown).

Traefik / Caddy с Docker provider могут находить реплики по labels без ручного `resolver`; смысл тот же — обратный прокси в стеке и round-robin по репликам.

## Kubernetes и managed cloud

Та же идея, что у Docker: **один процесс в Pod / задаче**, масштаб числом реплик.

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

Пробы и `terminationGracePeriodSeconds` должны быть больше (или хотя бы покрывать) `shutdown.timeout` приложения, иначе оркестратор может убить Pod раньше. HPA меняет `replicas` по CPU или своим метрикам; код приложения не трогают.

Управляемые контейнерные сервисы (AWS ECS/Fargate, Google Cloud Run, Azure Container Apps, Alibaba Cloud ACK/SAE и т.д.) сводят реплики, rolling и пробы в консоль или Terraform: вы по-прежнему поставляете **образ с одним процессом**, масштаб — платформе. Планировщики вроде HashiCorp Nomad — та же модель: реплики job × однопроцессная задача.

## Горизонтальное масштабирование PaaS

Fly.io Machines, Render services, Heroku dyno и аналоги масштабируются по «числу инстансов». Платформа поднимает несколько процессов и разводит трафик; во входе репозитория оставьте single-process `listen` и меняйте число через scale / instances в документации платформы — без `fork` в приложении.

## Дальше

- [Вход приложения](/ru/web/): `listen` / `shutdown` / proxyIP
- [Rate limiting](/ru/plugins/rate-limit): общий store при нескольких репликах
- [Кэш](/ru/core/cache): session и адаптеры Redis