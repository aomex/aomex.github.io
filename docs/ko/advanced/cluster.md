---
outline: deep
---

# 멀티 프로세스와 스케일링

단일 프로세스로는 코어를 다 쓰기 어렵거나 QPS를 올려야 할 때 Node 프로세스를 여러 개 띄운다. 흔한 경로는 **하나만** 고른다——겹치면 프로세스 수가 곱해진다(예: PM2 `-i 4` 위에 `clusterListen({ workers: 4 })` → 업무 프로세스 16개).

먼저 두 층 역할을 구분한다:

| 층 | 역할 |
| --- | --- |
| **프로세스 / 복제본을 누가 관리하는지** | Docker / K8s / PM2 / systemd / 클라우드 관리형… 이 몇 개를 띄우고, 죽으면 재시작하고, 롤링 배포를 담당 |
| **앱 진입점에 무엇을 쓰는지** | 대부분: **프로세스당 `app.listen` 한 번**; 「단일 호스트에서 Node 내장 cluster만 쓰고 별도 프로세스 관리자 없음」일 때만 `clusterListen` |

메모리 레이트 제한, memory 캐시, 프로세스 내부 Map은 프로세스 간 **공유되지 않는다**——복제본이 여러 개면 카운트와 session은 Redis 등 외부 저장소로 바꾼다. [레이트 제한](/ko/plugins/rate-limit) · [캐시](/ko/core/cache) 참고.

## 선택 가이드

| 방식 | 적합한 경우 |
| --- | --- |
| **리버스 프록시 + 다중 인스턴스** | 베어메탈 / 전통 VM: Nginx / Caddy / HAProxy 뒤에 여러 Node 포트 |
| **systemd**（다중 unit / 템플릿） | Linux 단일 호스트, 시스템 서비스와 같은 기동·중지·로그, Node 전용 PM 없이 |
| **PM2 `-i` / `instances`** | 단일 VM, 프로세스 관리·로그 집약·무중단 reload |
| **`clusterListen`** | 단일 머신 / VM, Node 내장 `cluster`, 추가 프로세스 관리자 없음 |
| **Docker Compose `scale` / Swarm + Nginx** | 이미 컨테이너화; 동일 스택 리버스 프록시, DNS가 복제본 자동 라운드로빈 |
| **K8s `replicas` / HPA** | 프로덕션 오케스트레이션: 롤링, 프로브, 쿼터, 자동 스케일 |
| **클라우드 관리형 복제**（ECS/Fargate, Cloud Run, Container Apps…） | 관리형 오케스트레이션, 제어 평면 적게; 의미는 여전히 「이미지 안 단일 프로세스 × 복제」 |
| **PaaS 수평 확장**（Fly.io, Render, Heroku dyno…） | 플랫폼이 「인스턴스 수」로 확장; 진입점은 단일 프로세스 listen |

아래는 시나리오별 설명이다. 클라우드 콘솔의 「복제 / instances」도 Docker / K8s와 같은 원칙이며, 벤더별 명령은 일일이 반복하지 않는다.

## 단일 프로세스 진입점（대부분 방식 공통）

Docker, K8s, 클라우드 관리형, PaaS, systemd, Nginx 다중 upstream, PM2 `-i`——진입 파일은 모두 일반적인 단일 프로세스 listen. 이미지 `CMD`, systemd `ExecStart`, `pm2 start`는 이 파일을 가리키면 된다:

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

종료는 [그레이스풀 셧다운](/ko/web/#shutdown)과 맞춘다: 오케스트레이터나 프로세스 관리자가 `SIGTERM`을 보내고, 앱이 연결을 비운 뒤 종료한다.

## 리버스 프록시 + 다중 인스턴스

컨테이너 오케스트레이션 없을 때 흔한 패턴: 한 대 또는 여러 대에서 Node 여러 개(포트 또는 호스트 분리), 앞단에 Nginx / Caddy / HAProxy로 로드밸런싱.

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

각 백엔드는 위 단일 프로세스 진입점(`PORT=3001` / `3002`…)을 그대로 쓴다. WebApp [proxyIP](/ko/web/)을 맞추지 않으면 레이트 제한 키·감사 로그에 클라이언트 대신 프록시가 보인다. 스케일 아웃은 프로세스를 더 띄우고 upstream을 고치는 것. 헬스 체크·연결 드레인은 프록시나 배포 스크립트가 담당한다.

## systemd

Linux에서 앱을 시스템 서비스로 등록할 수 있다: 부팅 시 기동, 크래시 재시작, journal 로그——Nginx와 같은 운영 습관. 다중 프로세스는 **여러 unit** 또는 **템플릿 unit**(`aomex@3001`, `aomex@3002`), 인스턴스마다 `PORT` 하나, 앞단에 리버스 프록시.

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

`TimeoutStopSec`은 앱 `shutdown.timeout`을 덮을 만큼 잡는다. 여기서 `ExecStart`에 `clusterListen`이나 PM2를 **겹치지 말 것**.

## PM2

단일 호스트에 오케스트레이션 없이 Node 생태계 프로세스 관리가 필요하면 PM2: 다중 인스턴스 기동, 로그, `reload` 무중단. 진입점은 단일 프로세스 listen 유지, 인스턴스 수는 `-i`에 맡긴다:

```bash
pm2 start dist/main.js -i max
# 或 ecosystem：instances: 'max' / 数字，exec_mode: 'cluster'
```

`-i max`는 대략 CPU 코어 수에 맞춘다. 숫자로 고정하는 편이 제어하기 쉽다. 이미 PM2 cluster 모드를 쓰므로 **`clusterListen`은 겹치지 않는다**.

## clusterListen

PM2나 systemd 다중 unit 없이 한 머신에서 Node 내장 `cluster`만 쓰려면 `@aomex/web`의 `clusterListen`: primary는 `fork`·시그널만, **실제 `listen`은 worker에서만**. `WebApp.listen` 자체는 바꾸지 않고, worker는 기존 셧다운 경로를 탄다.

App 생성과 `listen`을 `listen` 콜백에 넣고(필요 시 services `import`) primary가 업무 초기화를 헛돌지 않게 한다:

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

`workers: 'max'`는 `os.availableParallelism()`을 쓴다. `Math.min(4, availableParallelism())`으로 상한을 둘 수 있다. primary가 `SIGINT` / `SIGTERM`을 받으면 worker를 `disconnect`하고 종료를 기다린다(타임아웃 시 `SIGKILL`), 이후 `process.exit`.

| 옵션 | 역할 | 기본값 |
| --- | --- | --- |
| `workers` | 개수 또는 `'max'` | （필수） |
| `listen` | **worker에서만** 호출: App 생성 후 `listen` | （필수） |
| `respawn` | worker 예기치 않은 종료 후 다시 `fork` 여부 | `true` |
| `respawnDelay` | 다시 fork 전 대기(ms) | `1000` |
| `maxRespawns` | 예기치 않은 재기동 상한; 초과 시 primary 종료 코드 `1` | 제한 없음 |
| `shutdownTimeout` | 셧다운 대기, 초과 시 강제 종료 | `5000`（WebApp `shutdown.timeout` 기본과 동일） |
| `onListening` / `onExit` | primary에서 worker listen / 종료 관찰 | — |

::: warning
이미 리버스 프록시 다중 인스턴스, systemd 다중 unit, Docker / 클라우드 관리형 복제, K8s `replicas`, PM2 `-i`, PaaS 수평 확장 중 하나로 스케일했다면 **`clusterListen`을 겹치지 말 것**. 의도적 셧다운·`disconnect`로 인한 종료는 respawn하지 않는다. 예기치 않은 종료만 위 정책으로 다시 띄운다.
:::

## Docker Compose scale

이미지 안은 **한 프로세스 한 번 `app.listen`**. 복제 수는 Compose에 맡긴다. 같은 `compose.yaml`에 Nginx를 두는 구성이 흔하다: 80/443만 노출하고 서비스 이름 `web`으로 리버스 프록시——Docker 내장 DNS는**같은 서비스 이름의 여러 복제**를 해석하며, 아래처럼 쓰면 Nginx에 `3001`/`3002`/`3003`을 손으로 적지 않고 자동 라운드로빈할 수 있다.

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

`deploy`는 Swarm 의미다. `docker stack deploy`(또는 호환 도구)로야 파일대로 여러 복제가 뜬다. 일반 `docker compose up`은 `deploy`를 **자주 무시한다**. 로컬에서 잠깐 복제를 보려면 `--scale web=3`로 지정하면 된다.

Nginx에서는 서비스 이름에 upstream 한 줄이면 된다. Docker DNS는 `web`을 **그 시점의 모든 복제 주소**로 해석한다. Nginx가 여러 IP를 받으면 그 사이에서 라운드로빈한다——`server`를 세 대분 손으로 적을 **필요 없다**:

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

참고: 오픈소스 Nginx는 기본적으로 **시작 / reload 시** 호스트 이름을 해석하고 결과를 캐시한다. 복제가 먼저 뜬 뒤 Nginx를 기동할 때(`depends_on: web`) 위 설정으로 라운드로빈할 수 있다. 이후 `scale`로 복제를 늘리거나 줄였다면 **`nginx -s reload`**(또는 Nginx 컨테이너 재시작)로 다시 해석하게 해야 한다. reload하지 않으면 peer 목록은 예전 그대로다.

스케일 후 **reload 없이** 따라가게 하려면 Docker DNS(`resolver 127.0.0.11`)와 변수 형태의 `proxy_pass`(`set $upstream web; proxy_pass http://$upstream:3000;`)로 `valid` 주기마다 재해석하면 된다. 대부분의 동일 스택 배포에서는 upstream + 스케일 후 reload로 충분하다.

WebApp은 [proxyIP](/ko/web/)를 맞춰 둔다. **이미지 진입점에서 `clusterListen`이나 PM2 `-i`를 돌리지 말 것**. 종료는 `SIGTERM`과 [그레이스풀 셧다운](/ko/web/#shutdown)에 맞춘다.

Docker provider를 쓰는 Traefik / Caddy 같은 게이트웨이는 라벨로 복제를 자동 발견할 수 있어 `resolver`를 손으로 적지 않아도 된다. 의미는 같다——「동일 스택 리버스 프록시 + 복제 라운드로빈」.

## Kubernetes와 클라우드 관리형

Docker와 같은 생각: **Pod / 태스크 안 단일 프로세스**, 복제 수로 스케일.

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

프로브와 `terminationGracePeriodSeconds`는 앱 `shutdown.timeout`보다 크게(또는 최소한 덮을 만큼) 잡는다. 그렇지 않으면 오케스트레이터가 먼저 강제 종료할 수 있다. HPA는 CPU / 사용자 지표로 `replicas`를 조절하고, 앱 코드는 바꾸지 않는다.

관리형 컨테이너(AWS ECS/Fargate, Google Cloud Run, Azure Container Apps, Alibaba Cloud ACK/SAE 등)는 복제·롤링·프로브를 콘솔이나 Terraform에 모은다: 여전히 **단일 프로세스 이미지**를 내며 스케일은 플랫폼에 맡긴다. HashiCorp Nomad 등도 「job 복제 × 단일 프로세스 태스크」 같은 모델.

## PaaS 수평 확장

Fly.io Machines, Render services, Heroku dyno 등은 「인스턴스 수」로 확장한다. 플랫폼이 여러 프로세스를 띄우고 트래픽을 나눈다. 저장소 진입점은 단일 프로세스 `listen` 유지, 플랫폼 문서의 scale / instances 설정으로 수만 조절하면 되며 앱 안에서 `fork`할 필요 없다.

## 다음 단계

- [앱 진입점](/ko/web/): `listen` / `shutdown` / proxyIP
- [레이트 제한](/ko/plugins/rate-limit): 복제 다수일 때 공유 store
- [캐시](/ko/core/cache): session과 Redis 어댑터