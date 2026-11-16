---
outline: deep
---

# 속도 제한

시간 창 안에서 클라이언트 키를 세고, 초과 시 **429**—남용·버스트를 막습니다.

**사이트 전체 IP/연결 제한은 프로덕션 Nginx 우선**(`limit_req_zone` / `limit_req`)—Node 전에 차단, 복제본 간 Redis 불필요. `@aomex/rate-limit`는 **사용자/API Key 업무 키**, 로그인 SMS 등 라우트별 조이기, 리버스 프록시 없는 임시 대안에 맞습니다.

기본은 **메모리** 카운터—단일 인스턴스면 충분합니다. 복제본에서 앱 내 집계가 필요하면 Redis, 아니면 한도는 대략 `maxRequest × 인스턴스 수`.

```bash
pnpm add @aomex/rate-limit
# 多实例且必须在应用内共享计数：
pnpm add @aomex/rate-limit-redis-store ioredis
```

## 사이트 전체 마운트

엣지가 이미 IP로 제한하면 앱에서 또 사이트 전체 `rateLimit()`는 생략하세요. 업무 키나 로컬 직결이면 `rateLimit()`를 앞쪽 mount에 둡니다. 초과 시 **429**, action마다 카운트할 필요 없습니다. 복제본 공유는 아래 Redis store.

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

일반 `WebMiddleware`이며 초과 시 HTTP **429**—action에서 수동 검사 없음. `id`가 `false`면 카운트 제외(헬스체크 등).

## 키와 목록

| 옵션 | 언제 쓰나 | 기본값 |
| --- | --- | --- |
| `duration` | 창 길이 | 1시간 |
| `maxRequest` | 창당 허용 횟수 | 2500 |
| `id` | API Key/사용자; `false`면 면제 | IP |
| `message` / `statusCode` | 429 본문·코드 | 패키지 기본 |

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

### 단일 라우트만

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

### 프로덕션 복제본: Redis

```typescript
import { RateLimitRedisStore } from '@aomex/rate-limit-redis-store';
import Redis from 'ioredis';

rateLimit({
  store: new RateLimitRedisStore(new Redis()), // [!code highlight]
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

| 환경 | 권장 |
| --- | --- |
| 로컬 직결 | 느슨한 상한의 앱 제한 OK—개발 중 스스로 잠기지 않게 |
| 엣지 IP 제한 | 앱 사이트 전체 제한 중복 피하기 |
| 복제본 + 업무 키 | Redis store로 공유 카운트 |

메모리 store는 재시작 시 카운터가 리셋됩니다. 로그인·결제 같은 민감 라우트는 `id`를 사용자/API Key로 좁히세요.

## 관련

- 인증 키: [API Key 전략](/ko/plugins/auth-api-key-strategy)
- [미들웨어](/ko/core/middleware)