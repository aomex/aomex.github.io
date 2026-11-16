---
outline: deep
---

# Rate limiting

Count requests per client key inside a time window; over limit → **429**—blocks abuse and bursts.

**Site-wide limits by IP/connection: prefer Nginx** (`limit_req_zone` / `limit_req`)—rejected before Node; no Redis needed across replicas. `@aomex/rate-limit` fits **per-user / API Key business keys**, tight per-route limits (login SMS), or temporary cover without a reverse proxy.

Default **in-memory** counters—fine on one machine; multiple replicas needing in-app counts require Redis or effective limit ≈ `maxRequest × instance count`.

```bash
pnpm add @aomex/rate-limit
# multi-instance shared counting in app:
pnpm add @aomex/rate-limit-redis-store ioredis
```

## Site-wide mount

If the edge already rate-limits by IP, skip another site-wide `rateLimit()` in the app. For business keys or local direct access, mount `rateLimit()` early: over limit → **429** without per-action counters. Shared counting across replicas needs Redis store below.

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

Plain `WebMiddleware`; over limit throws HTTP **429**—no manual checks in actions. `id` returning `false` skips counting (health checks).

## Keys and lists

| Option | When to use | Default |
| --- | --- | --- |
| `duration` | Window length | 1 hour |
| `maxRequest` | Allowed count per window | 2500 |
| `id` | API Key / user; `false` exempts | IP |
| `allowList` / `denyList` | Skip internal; block IPs | — |
| `store` | **Multi-instance must** use Redis etc. | memory |

### By key / user, skip health

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

### Single route only

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

### Production replicas: Redis

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

| Environment | Guidance |
| --- | --- |
| Local direct | App limit OK with loose caps—avoid locking yourself out while testing |
| Production with Nginx | **Prefer** `limit_req` for IP/connection; app layer for login, SMS, per-key quotas |
| Multi Pod + in-app count | **Must** shared `store` (Redis); do not stack tight IP limits with gateway and hurt innocents |

Custom stores implement atomic `getAndSet` per package `RateLimitStore`—follow type definitions.

IP-only limits behind NAT share one key for a whole office—easy false positives; login routes fit user or API Key better. Site-wide caps too tight? Per-hot-route `mount` is common.

## Next steps

- Real client IP (limit key): [App entry](/en/web/) `proxyIP`
- Identity dimension: [Auth](/en/plugins/auth)
- Error shape: [Error format](/en/web/errors)