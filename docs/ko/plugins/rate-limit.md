---
outline: deep
---

# 요청 제한

시간 창 안에서 클라이언트 식별자별로 카운트하고, 초과 시 **429**를 반환해 API 남용과 급증 트래픽을 막습니다.

**IP·연결 기준 전역 제한은 프로덕션에서 Nginx 우선**(예: `limit_req_zone` / `limit_req`): 요청이 Node에 들어오기 전에 막히고, 여러 복제본도 Redis 없이 시작할 수 있습니다. `@aomex/rate-limit`은 **사용자 / API Key 같은 비즈니스 key**, 로그인·SMS 등 단일 라우트 강화, 또는 역방향 프록시가 없을 때 임시로 쓰기에 더 맞습니다.

기본은 **프로세스 내 memory** 카운트 — 단일 호스트면 충분합니다. 여러 복제본에서 반드시 앱 안에서 카운트해야 하면 Redis로 바꿔야 하며, 그렇지 않으면 실질 한도는 대략 `maxRequest × 인스턴스 수`입니다.

```bash
pnpm add @aomex/rate-limit
# 多实例且必须在应用内共享计数：
pnpm add @aomex/rate-limit-redis-store
```

## 전역 마운트

엣지에서 이미 IP 기준으로 제한했다면 앱에 전역 `rateLimit()`을 또 걸 필요는 없습니다. 비즈니스 key가 필요하거나 로컬 직결일 때 `rateLimit()`을 mount 앞쪽에 두면, 창 안 초과 시 곧바로 **429**이고 action마다 횟수를 셀 필요가 없습니다. 복제본 간 공유 카운트는 Redis store로 바꾸세요(아래 참고).

```typescript
import { rateLimit } from '@aomex/rate-limit';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:7]
    rateLimit({
      maxRequest: 100,
      duration: 60_000, // [!code highlight]
    }),
    routers('./src/routers'),
  ],
});
```

일반 WebMiddleware입니다. 초과 시 HTTP 오류를 던지며 상태는 **429**이고, action마다 조건을 쓸 필요가 없습니다. `id`가 `false`를 반환하면 해당 요청은 카운트하지 않습니다(헬스 체크에 흔함).

## 카운트 key와 화이트리스트

| 옵션 | 언제 쓰나 | 기본값 |
| --- | --- | --- |
| `duration` | 창 길이 | 1시간 |
| `maxRequest` | 창 안 허용 횟수 | 2500 |
| `id` | API Key / 사용자 기준; `false`면 면제 | IP |
| `allowList` / `denyList` | 사내망 스킵; IP 차단 | — |
| `store` | **다중 인스턴스면 반드시** Redis 등 | memory |

### Key·사용자 기준, 헬스 체크 제외

```typescript
rateLimit({
  maxRequest: 60,
  duration: 60_000,
  id: (ctx) => { // [!code highlight]
    if (ctx.request.pathname === '/health') {
      return false;
    }
    const key = ctx.request.headers['x-api-key'];
    if (typeof key === 'string') {
      return key;
    }
    return ctx.request.ip;
  },
  allowList: (ctx) => {
    return ctx.request.ip === '127.0.0.1';
  },
});
```

### 단일 라우트만 제한

```typescript
import { body } from '@aomex/web';
import { rule } from '@aomex/common';

router.post('/login', {
  mount: [
    rateLimit({ maxRequest: 10, duration: 60_000 }), // [!code highlight]
    body({ email: rule.email(), password: rule.string() }),
  ],
  action: async (ctx) => {
    /* ... */
  },
});
```

### 프로덕션 다중 복제본: Redis

생성 시 **`RedisOptions`만** 넘깁니다(`host` / `port` 등; 타입은 이 패키지에서 가져올 수 있음). 이미 만든 `Redis` 인스턴스는 넘기지 마세요. `ioredis`는 `@aomex/rate-limit-redis-store`에 포함되어 별도 의존성이 필요 없습니다. store는 내부에서 `lazyConnect`하고, `rateLimit()`이 [`registerLifecycle`](/ko/core/service#라이프사이클-훅)으로 프로세스 측 연결·해제를 합니다.

```typescript
import { RateLimitRedisStore } from '@aomex/rate-limit-redis-store';

rateLimit({
  store: new RateLimitRedisStore({ // [!code highlight]
    host: '127.0.0.1',
    port: 6379,
  }),
  maxRequest: 500,
  duration: 3_600_000,
  id: (ctx) => {
    const key = ctx.request.headers['x-api-key'];
    if (typeof key === 'string') {
      return key;
    }
    return ctx.request.ip;
  },
});
```

기본 memory store는 `@aomex/rate-limit/memory`에서 명시적으로 가져올 수 있으며, 종료 시 프로세스 내 카운트가 비워집니다.

| 환경 | 권장 |
| --- | --- |
| 로컬 직결 | 앱 제한을 걸어도 되나 한도는 넉넉히 — 자신을 잠그지 않게 |
| 프로덕션 + Nginx | **우선** `limit_req` 등으로 IP·연결 제한; 앱 레이어는 로그인·SMS·Key별 할당량 |
| 프로덕션 다중 Pod + 앱 내 카운트 | **필수** 공유 `store`(Redis); 게이트웨이와 동일한 과도한 IP 한도를 겹쳐 오탐 피하기 |

커스텀 저장소는 패키지 `RateLimitStore`의 원자적 `getAndSet`을 구현해야 합니다. 연결·해제가 필요하면 `onInit` / `onDestroy`를 오버라이드할 수 있고(`rateLimit()`이 자동 등록). 시그니처는 타입 정의를 따르세요.

IP만으로 제한하면 NAT 뒤 한 건물이 하나의 key를 공유해 오탐이 나기 쉽습니다. 로그인 등은 사용자나 API Key 기준이 낫습니다. 전역 한도가 너무 촘촘하면 핫 라우트만 별도 mount하는 경우가 많습니다.

## 다음 단계

- 허니팟 / 오류 누적 / IP 차단: [남용 방어](/ko/plugins/abuse)
- 실제 IP(제한 key): [Web 앱](/ko/web/)의 proxyIP
- 신원 차원: [Auth](/ko/plugins/auth)
- 오류 형태: [오류 형식](/ko/web/errors)