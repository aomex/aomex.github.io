---
outline: deep
---

# Abuse protection

Directory scans, honeypot hits, burst 404s, fake tokens on logout—these are often probing your edges, not ordinary traffic spikes. `@aomex/abuse` **counts** by strategy and, when the limit is hit, **blocks the IP** (or calls you to ban an account). It complements [rate limiting](/en/plugins/rate-limit): rate limits blunt burst QPS; abuse catches probes and business-reported malice.

Counts and block state live on a `@aomex/cache` adapter (memory / Redis, etc.). Share Redis across instances. It relies on `ctx.request.ip`—in production set `proxyIP: { mode: 'detect' }` (or a fixed trust chain), or every request may look like the reverse proxy.

```bash
pnpm add @aomex/abuse
# also need @aomex/cache (and a Redis adapter in production)
```

## Mount the middleware

`createAbuse` returns a value that is **both middleware and an API** (`userAbuse` / `ipAbuse` / `blockIP`, …)—**not** hung on `ctx`. Create the instance, `mount` it, then call the same object from routes or services.

```typescript
import { createAbuse } from '@aomex/abuse';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import { routers, WebApp } from '@aomex/web';

const abuse = createAbuse({ // [!code focus:18]
  store: new CacheMemoryAdapter(),
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
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [abuse, routers('./src/routers')], // [!code highlight]
});
```

Use memory locally / in tests; for multi-replica production pass a Redis adapter as `store`, or blocks stay local. `window` / `blockFor` accept milliseconds or readable strings (`'1 hour'`, `'30m'`)—the same `DurationInput` as [Cache](/en/core/cache#durationinput).

On each request: if the IP is already blocked → default **403**; honeypot hit that reaches the limit → block and 403 immediately. `http-error` counts after the response; **the request that crosses the limit still returns the original status**, and only the next request becomes 403.

## Four strategies

| Strategy | What increments | On limit |
| --- | --- | --- |
| `honeypot` | Hits on bait paths you place | Block IP |
| `http-error` | Responses with listed status codes (`throw` or `send`) | Block IP |
| `ip-abuse` | Business calls `abuse.ipAbuse(ip, reason)` | Block IP |
| `user-abuse` | Business calls `abuse.userAbuse(id, reason)` | Only `onBanUser`—**no** automatic IP block |

### Honeypot paths

Path strings support exact match and simple globs; you can also pass a regex. Regexes test `pathname + search`, handy for odd query probes. `methods` is optional; omit to allow any method.

| Pattern | Matches |
| --- | --- |
| Exact (no `*`) | Full pathname equality—`'/.env'` does not match `'/.env.local'` |
| `*` | Any chars **within one segment**, **no** `/`. `'/wp-*.php'` matches `/wp-login.php`, not `/wp/admin.php` |
| `**` | **Across segments**. `'/a/**/c'` matches `/a/b/d/c`, not `/a/c` (needs at least one middle segment) |
| Trailing `/**` | The directory itself plus any deeper children. `'/.git/**'` matches `/.git`, `/.git/config`, not `/.github` |
| `RegExp` | Tests `pathname + search`, e.g. `/^\/admin\?.*dump=/` |

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

Globs look at pathname only; query does not matter—use a regex to include query. `paths` must not be empty; validated at create time. Braces and similar are not expansion syntax—matched literally.

### Count by error status

Multiple `statusCodes` in one strategy are **pooled**. Optionally narrow with `paths` / `methods`; omit to count site-wide for those statuses.

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

Good against API scanners. If you also want strict 401s on login, add a separate strategy with `paths`—do not mix them into the same bucket as site-wide 404s.

### Business reports: IP

When the response is still success (e.g. logout always 204) but you want to tally suspicious probes per IP, use `ip-abuse` and call it from the route. `reason` can be a string; it must match a strategy entry—unknown reasons throw at runtime. One strategy per reason.

```typescript
const abuse = createAbuse({
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
    const hit = await services.cache.deleteLoginToken(token);
    if (!hit) {
      await abuse.ipAbuse(ctx.request.ip, 'logout-miss'); // [!code highlight]
    }
    ctx.send(204);
  },
});
```

When reasons grow, you can also use a TypeScript `enum` (string or numeric members) so magic strings do not scatter. Pass enum members in strategies and to `ipAbuse`; the second argument then narrows to members that appear in strategies—unconfigured members and bare `'logout-miss'` are type errors.

```typescript
enum IpAbuseReason {
  LogoutMiss = 'logout-miss',
  TokenProbe = 'token-probe',
}

// in strategies: reason: IpAbuseReason.LogoutMiss
await abuse.ipAbuse(ctx.request.ip, IpAbuseReason.LogoutMiss);
```

### Business reports: user

Account-level abuse (promo abuse, post-credential-stuffing user signals, etc.) uses `user-abuse`. The package **does not write your user store**—on limit it only calls `onBanUser`; you update the DB and drop sessions there. If any `user-abuse` strategy exists, **`onBanUser` is required** (checked at create). `reason` can be a string or an enum.

```typescript
const abuse = createAbuse({
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

With an enum, use the same pattern as IP: strategy uses `UserAbuseReason.OrderProbe`; reports and `onBanUser`'s `reason` become a union of those members. Numeric enums (e.g. `OrderProbe = 1`) work too; storage uses `String(reason)`, so bucket keys are string forms.

`detail` has `count` / `limit` and `banFor` in milliseconds (`undefined` if the strategy omits it). For the same user and reason, `onBanUser` fires at most once per window (cache placeholder avoids concurrent duplicates); if the callback throws, the placeholder is cleared so the window can retry.

## Manual blocks and hooks

| API | Role |
| --- | --- |
| `blockIP(ip, duration)` | Manual IP block; if already blocked, skip (no TTL refresh, no duplicate callback) |
| `unblockIP(ip)` | Clear block |
| `isIPBlocked(ip)` | Whether blocked |
| `onBlockIP` | Fired on strategy hit, `ipAbuse` limit, or manual `blockIP` |
| `bypass` | Skip probe counting and block checks (health, intranet) |
| `blockedError` | Custom `HttpError` when blocked (default 403) |

```typescript
const abuse = createAbuse({
  store,
  strategies: [/* ... */],
  bypass: (ctx) => {
    return ctx.request.pathname === '/health';
  },
  blockedError: new HttpError(429, 'blocked', { code: 'ABUSE_BLOCKED' }),
  onBlockIP: async (ip, reason, detail) => {
    services.logger.warn('abuse.block', { ip, reason, ...detail });
  },
});

await abuse.blockIP('203.0.113.8', '1 day');
await abuse.unblockIP('203.0.113.8');
```

`onBlockIP`'s `reason` is `'honeypot' | 'http-error' | 'ip-abuse' | 'manual'`; `detail.blockFor` is milliseconds.

::: tip
Abuse blocks are “caught you—lock for a while”; soft site-wide limits still belong in [rate limiting](/en/plugins/rate-limit). You can mount both: rate limit first for spikes, abuse for strategy-based bans.
:::

## Related

- [Rate limiting](/en/plugins/rate-limit)
- [Cache](/en/core/cache) (`store` adapters and `DurationInput`)
- [CSRF](/en/plugins/csrf)
