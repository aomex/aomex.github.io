---
outline: deep
---

# Rate limiting

Count requests per client identity inside a time window; over the limit return **429**. Use it to blunt scrapers and traffic spikes.

**For site-wide IP / connection limits in production, prefer Nginx** (`limit_req_zone` / `limit_req`): traffic never reaches Node, and multi-replica setups do not need Redis first. `@aomex/rate-limit` fits **per-user / API Key business keys**, tightening a single route (login, SMS), or holding the line locally when there is no reverse proxy yet.

Default counting is **in-process memory**—fine on one node. Multi-replica that must share counts needs Redis, or the effective cap is roughly `limit × instances`.

```bash
pnpm add @aomex/rate-limit
# Multi-instance and you must share counts in the app:
pnpm add @aomex/rate-limit-redis-store
```

## Mount site-wide

If the edge already limits by IP, you do not need another full-site `rateLimit()`. For business keys or local direct access, put `rateLimit()` early in mount: over limit → **429**, with no per-action counters.

```typescript
import { rateLimit } from '@aomex/rate-limit';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'en-US' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:7]
    rateLimit({
      limit: 100,
      window: 60_000, // [!code highlight]
    }),
    routers('./src/routers'),
  ],
});
```

`window` is the counting window (milliseconds or readable durations like `'1 hour'` / `'30s'`; default 1 hour). `limit` is how many hits are allowed in that window (default 2500). With no options you get “per IP, 2500 per hour”—keep it loose on local direct access so you do not lock yourself out while debugging.

Plain WebMiddleware; over limit throws an HTTP error with status **429**. Responses include `X-RateLimit-*` headers; pass `headers: false` to turn them off.

## Per Key / user, skip health checks

Default `id` is `ctx.request.ip`. To bucket by API Key or logged-in user, write your own `id`; return `false` to skip counting (common for health checks). Skip a whole intranet range with `allowList`; block certain IPs outright with `denyList` (hits throw **403**, no counting).

```typescript
rateLimit({
  limit: 60,
  window: 60_000,
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

IP-only limits behind NAT share one key for a whole office—easy false positives. Login and SMS routes suit user or API Key keys better. When the site-wide cap is too loose, mount a tighter limit on hot routes.

## Limit a single route

Login and captcha endpoints often need a tighter cap than the site-wide one. Mount `rateLimit()` on that route next to `body()`.

```typescript
import { body } from '@aomex/web';
import { rule } from '@aomex/common';

router.post('/login', {
  mount: [
    rateLimit({ limit: 10, window: 60_000 }), // [!code highlight]
    body({ email: rule.email(), password: rule.string() }),
  ],
  action: async (ctx) => {
    /* ... */
  },
});
```

## Multi-replica production: Redis

If every pod still uses the default memory store, each instance counts alone and the total quota multiplies. For shared counts, switch to `@aomex/rate-limit-redis-store`.

Pass `RedisOptions` only (`host` / `port`, …)—not an already-built `Redis` instance. `ioredis` ships with the package; you do not add it separately. The store `lazyConnect`s; `rateLimit()` registers connect / disconnect via [`registerLifecycle`](/en/core/service#lifecycle-hooks).

```typescript
import { RateLimitRedisStore } from '@aomex/rate-limit-redis-store';

rateLimit({
  store: new RateLimitRedisStore({ // [!code highlight]
    host: '127.0.0.1',
    port: 6379,
  }),
  limit: 500,
  window: 3_600_000,
  id: (ctx) => {
    const key = ctx.request.headers['x-api-key'];
    if (typeof key === 'string') {
      return key;
    }
    return ctx.request.ip;
  },
});
```

You can also import the default memory store explicitly from `@aomex/rate-limit/memory`; shutdown clears in-process counts. Custom stores implement atomic `getAndSet` on `RateLimitStore`; override `onInit` / `onDestroy` when you need connect / disconnect (`rateLimit()` registers them). Follow the type definitions.

::: tip
With Nginx in production: **prefer** `limit_req` (and similar) for IP / connection limits; leave the app layer for login, SMS, and per-key quotas. Do not stack the same tight IP cap on both gateway and app until you false-positive yourself.
:::

## Next

- Honeypot / error tallies / IP blocks: [Abuse protection](/en/plugins/abuse)
- WebSocket inbound message limits: [Rate limiting (WebSocket)](/en/websocket/rate-limit)
- Real client IP (rate-limit key): `proxyIP` on [Web entry](/en/web/)
- Identity: [Auth](/en/plugins/auth)
- Error shape: [Error format](/en/web/errors)
