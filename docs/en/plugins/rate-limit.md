---
outline: deep
---

# Rate limiting

Count requests per client identifier inside a time window; return **429** when over the limit—to blunt API abuse and traffic spikes.

**IP / connection-wide limits in production: prefer Nginx** (e.g. `limit_req_zone` / `limit_req`) so requests never reach Node and replicas do not need Redis first. `@aomex/rate-limit` fits better when you need **per-user / API Key business keys**, tighter limits on login or SMS routes, or no reverse proxy locally.

Default **in-process memory** counters—fine on one machine; with multiple replicas and in-app counting you need Redis or the effective cap is roughly `maxRequest × instance count`.

```bash
pnpm add @aomex/rate-limit
# Multi-instance shared in-app counting:
pnpm add @aomex/rate-limit-redis-store
```

## App-wide mount

If the edge already rate-limits by IP, you do not need another app-wide `rateLimit()`. When you need business keys or run without a proxy, put `rateLimit()` early in `mount`: over limit in the window → **429** without counting in every action. Multi-replica shared counts need a Redis store (below).

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

A normal `WebMiddleware`; over limit throws an HTTP error with **429**—no per-action checks. `id` returning `false` skips counting (common for health checks).

## Counter keys and allow/deny lists

| Option | When to use | Default |
| --- | --- | --- |
| `duration` | Window length | 1 hour |
| `maxRequest` | Allowed hits per window | 2500 |
| `id` | Per API Key / user; `false` exempts | IP |
| `allowList` / `denyList` | Skip internal nets; block IPs | — |
| `store` | **Multi-instance: use Redis** | memory |

### Per key / user, skip health checks

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

### Production multi-replica: Redis

Construct with **`RedisOptions` only** (`host` / `port`, etc.; types from this package)—do **not** pass an existing `Redis` instance. `ioredis` ships with `@aomex/rate-limit-redis-store`; no extra install. The store uses `lazyConnect`; `rateLimit()` connects/disconnects via [`registerLifecycle`](/en/core/service#lifecycle-hooks) on the process side.

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

The default memory store can be imported explicitly from `@aomex/rate-limit/memory`; in-process counts clear on shutdown.

| Environment | Recommendation |
| --- | --- |
| Local direct access | App rate limit OK; keep limits loose so dev does not lock you out |
| Production with Nginx | **Prefer** `limit_req` for IP / connection limits; app layer for login, SMS, per-key quotas |
| Production multi-pod + in-app counts | **Must** use shared `store` (Redis); do not stack tight IP limits from the gateway on top |

Custom stores implement atomic `getAndSet` on the package’s `RateLimitStore`; override `onInit` / `onDestroy` when you need connect/teardown (`rateLimit()` registers automatically). Follow the type definitions.

IP-only limits behind NAT share one key for a whole office—easy false positives; login routes suit user or API Key keys better. When global limits are tight, per-route `mount` is more common.

## Next steps

- Honeypot / error tallies / IP blocks: [Abuse protection](/en/plugins/abuse)
- Real client IP (rate-limit key): `proxyIP` on [Web entry](/en/web/)
- Identity dimension: [Auth](/en/plugins/auth)
- Error shape: [Error format](/en/web/errors)