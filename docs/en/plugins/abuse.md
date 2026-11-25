---
outline: deep
---

# Abuse protection

Directory scans, honeypot hits, burst 404s, fake tokens on logout—these are often probing your edges, not ordinary traffic spikes. `@aomex/abuse` **counts** by strategy and, when the limit is hit, **blocks the IP** (or calls you to ban an account). It complements [rate limiting](/en/plugins/rate-limit): rate limits blunt burst QPS; abuse catches probes and business-reported malice.

Counts and block state live on a shared [`Caching`](/en/core/cache) (memory / Redis, etc.). Share Redis across instances. Relies on `ctx.request.ip`—in production set `proxyIP: { mode: 'detect' }` (or a fixed trust chain), or every request may look like the reverse proxy.

```bash
pnpm add @aomex/abuse
# also need existing @aomex/cache (and a Redis adapter in production)
```

## Create and mount `.web()`

`new Abuse(...)` gives you a **service** (APIs like `ipAbuse` / `blockIP`), not middleware you drop straight into `mount`. On HTTP use `.web()` on `WebApp.mount`. Keep calling APIs on that same `abuse` instance—it is **not** hung on `ctx`.

The config below mounts two common strategies first: honeypot paths (one hit → block) and error-status tallies (burst 401 / 404 before block).

```typescript
import { Abuse } from '@aomex/abuse';
import { Caching } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const cache = new Caching(new CacheMemoryAdapter());

const abuse = new Abuse({ // [!code focus:18]
  store: cache,
  strategies: [
    {
      strategy: 'honeypot',
      paths: ['/.env', '/wp-admin/**'],
      limit: 1,
      window: '1 hour',
      blockFor: '1 month',
    },
    {
      strategy: 'http-error',
      statusCodes: [401, 404],
      limit: 30,
      window: '10 minutes',
      blockFor: '1 week',
    },
  ],
});

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'en-US' },
  proxyIP: { mode: 'detect' },
  mount: [abuse.web(), routers('./src/routers')], // [!code highlight]
});
```

Use memory locally / in tests; for multi-replica production pass a Redis adapter as `store`, or blocks stay local. `window` / `blockFor` accept milliseconds or readable strings (`'1 hour'`, `'30m'`)—the same `DurationInput` as [Cache](/en/core/cache#durationinput).

On request: if the IP is already blocked → default **403**; honeypot hit at limit → block and 403 immediately. `http-error` counts after the response—**the hitting request still returns the original status**; the next request gets 403.

On WebSocket use the same `abuse` with `.socket()` (event honeypots, etc.)—see [Abuse protection (WebSocket)](/en/websocket/abuse); this page does not repeat it.

## Honeypot paths

Place paths a normal user never hits (`/.env`, `/wp-admin/**`, …). Hits count per IP; at the limit the IP is blocked. Path strings support exact match and simple globs; you can also pass a regex. Regexes test `pathname + search`, which helps catch probes with odd query strings. `methods` is optional; omit it to allow any method.

```typescript
{
  strategy: 'honeypot',
  paths: ['/.env', '/.env*', '/.git/**', '/wp-*.php', /^\/admin\?.*dump=/],
  methods: ['GET'],
  limit: 1,
  window: '1 hour',
  blockFor: '1 day',
}
```

Pattern reference:

| Pattern | Matches |
| --- | --- |
| Exact (no `*`) | Full pathname equality—`'/.env'` does not match `'/.env.local'` |
| `*` | Any chars **within one segment**, **no** `/`. `'/wp-*.php'` hits `/wp-login.php`, not `/wp/admin.php` |
| `**` | **Across segments**. `'/a/**/c'` hits `/a/b/d/c`, not `/a/c` (at least one segment in between) |
| Trailing `/**` | Directory itself plus any deeper children. `'/.git/**'` hits `/.git` and `/.git/config`, not `/.github` |
| `RegExp` | Tests `pathname + search`, e.g. `/^\/admin\?.*dump=/` |

Globs look at pathname only—query does not matter; use a regex when query must count. `paths` cannot be empty; creation validates that. Brace expansion and friends are not supported—matched as literals.

## Error status tallies

A burst of 404 / 401 often means scanning or credential stuffing. Use `http-error`: multiple `statusCodes` in one strategy **share one counter**. You can further limit with `paths` / `methods`; omit them to count that status site-wide.

```typescript
{
  strategy: 'http-error',
  statusCodes: [404],
  paths: ['/api/**'],
  limit: 50,
  window: '15 minutes',
  blockFor: '2 hours',
}
```

Good for API scanners. If you also want to police 401 on login, hang a separate strategy with `paths`—do not mix it into the same bucket as site-wide 404.

## Business report: fake token probes

Sometimes the response itself is success (e.g. logout always returns 204 whether the token exists), but you still want to count “suspicious probes” per IP. Use `ip-abuse` and call it from the route. `reason` is a string and must match a strategy declaration; unknown reasons throw at runtime. One reason → one strategy only.

```typescript
const abuse = new Abuse({
  store,
  strategies: [
    {
      strategy: 'ip-abuse',
      reason: 'logout-miss',
      limit: 5,
      window: '1 hour',
      blockFor: '6 hours',
    },
  ],
});

router.post('/logout', {
  action: async (ctx) => {
    const hit = await services.user.deleteLoginToken(token);
    if (!hit) {
      await abuse.ipAbuse(ctx.request.ip, 'logout-miss'); // [!code highlight]
    }
    ctx.send(204);
  },
});
```

When reasons pile up, a TypeScript `enum` (string or numeric members) keeps magic strings from spreading. Pass enum members in both strategies and `ipAbuse`; the second argument then narrows to members that appear in strategies—unconfigured members and bare `'logout-miss'` are type-blocked.

```typescript
enum IpAbuseReason {
  LogoutMiss = 'logout-miss',
  TokenProbe = 'token-probe',
}

// in strategies: reason: IpAbuseReason.LogoutMiss
await abuse.ipAbuse(ctx.request.ip, IpAbuseReason.LogoutMiss);
```

## Business report: account dimension

Account-level abuse (coupon farming, user-scoped stuffing after credential hits) uses `user-abuse`. The package **does not touch your user store**—at the limit it only calls `onBanUser`; you update the DB and kick sessions in the callback. If any `user-abuse` strategy is configured, **`onBanUser` is required** and checked at creation. `reason` can be a string or an enum.

```typescript
const abuse = new Abuse({
  store,
  strategies: [
    {
      strategy: 'user-abuse',
      reason: 'order-probe',
      limit: 10,
      window: '1 day',
      banFor: '7 days', // suggested ban length, passed through the callback
    },
  ],
  onBanUser: async (id, reason, detail) => { // [!code focus:6]
    await db.user.update({
      where: { id: Number(id) },
      data: { bannedUntil: new Date(Date.now() + (detail.banFor ?? 0)) },
    });
  },
});

await abuse.userAbuse(userId, 'order-probe');
```

With an enum, the pattern matches IP: strategies use `UserAbuseReason.OrderProbe`; report calls and `onBanUser`’s `reason` narrow to those members. Numeric enums (`OrderProbe = 1`) work too; storage runs `String(reason)`, so bucket keys are string forms.

`detail` includes `count` / `limit`, and `banFor` resolved to milliseconds (`undefined` if the strategy omitted it). For the same user + reason, `onBanUser` succeeds at most once per window (a cache placeholder stops concurrent duplicates); if the callback throws, the placeholder is released so the window can retry.

## Health-check bypass and manual blocks

Probe paths should not hit block logic: pass `bypass` to `.web()`. Ops can temporarily block / unblock an IP with `blockIP` / `unblockIP`; use `isIPBlocked` to query. For audit logs, hang `onBlockIP`—strategy trips, `ipAbuse` at limit, and manual `blockIP` all call it.

Blocked requests default to **403**; pass `blockedError` to align with rate-limit semantics (e.g. 429).

```typescript
import { logger } from '@/services/logger.service';

const abuse = new Abuse({
  store,
  strategies: [/* ... */],
  onBlockIP: async (ip, reason, detail) => {
    await logger.withBindings({ ip, reason, ...detail }, async () => {
      logger.warn('abuse.block');
    });
  },
});

mount: [
  abuse.web({ // [!code focus:6]
    bypass: (ctx) => {
      return ctx.request.pathname === '/health';
    },
    blockedError: new HttpError(429, 'blocked', { code: 'ABUSE_BLOCKED' }),
  }),
  routers('./src/routers'),
],

await abuse.blockIP('203.0.113.8', '1 day');
await abuse.unblockIP('203.0.113.8');
```

On the HTTP side, `onBlockIP`’s `reason` is commonly `'honeypot' | 'http-error' | 'ip-abuse' | 'manual'`; if the same instance also mounts a WebSocket event honeypot, you will also see `'socket-events'` (see [Abuse protection (WebSocket)](/en/websocket/abuse)). `detail.blockFor` is milliseconds; calling `blockIP` again on an already-blocked IP is a no-op (TTL not refreshed, callback not repeated).

::: tip
Abuse blocks lean “caught you—sit out a while”; soft site-wide throttling still lives in [rate limiting](/en/plugins/rate-limit). Mount both: rate limit first for spikes, abuse for strategy tallies then block.
:::

## Related

- [Rate limiting](/en/plugins/rate-limit)
- [Abuse protection (WebSocket)](/en/websocket/abuse)
- [Cache](/en/core/cache) (`store` adapters and `DurationInput`)
- [CSRF protection](/en/plugins/csrf)
