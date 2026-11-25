# Cache

At the composition root build one shared **`Caching`**: pick a memory / file / Redis adapter, then pass the **same instance** to business code and to auth / abuse / OAuth plugins (config name is usually `store`). Walk a login **session** (token → user payload) through issue → read on auth → delete on logout.

Keep the class name `Caching`—do not rename it to `Cache`, which clashes with the TypeScript DOM / Web Cache API global. Prefer the variable name `cache`. First read/write connects lazily; shutdown disconnects via internal `registerLifecycle`.

`src/cache.ts` **only exports** `cache` and `remember`. Login sessions and business key prefixes live in their own Services, which `import { cache }` from here.

```typescript
// src/cache.ts
import { Caching, createRemember } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export const cache = new Caching(new CacheMemoryAdapter()); // [!code highlight]
export const remember = createRemember(cache);
```

`get` / `set` / `delete` / `getAndDelete` / `singleFlight` accept a **string or `CacheKey`**. With `get<T>(key)`, the return type is `T | null`; TTL on `set` / `setNX` / `expire` is **`DurationInput`**: milliseconds or a readable string (`'7 days'`, `'30m'`, `'1.5 hours'`)—see below.

Plugins take that instance directly:

```typescript
import { cache } from '@/cache';

new Abuse({ store: cache, strategies: [/* … */] });
new AuthSessionStrategy({ store: cache, /* … */ });
new OAuth2Client({ store: cache, /* … */ });
```

::: tip
Do not `new Caching(adapter)` inside each plugin—create once at the composition root and share. For two stores (local memory + shared Redis), build a second instance and call `createRemember` per instance.
:::

## Session read/write

After login issues a token, write token → user payload; read it back in auth `onLoaded`; delete on logout. Version the `CacheKey` prefix so a schema change invalidates the whole batch in one place—put these methods on a User / Auth Service:

```typescript
// src/services/user.service.ts
import { Service } from '@aomex/common';
import { cache } from '@/cache';

export default class UserService extends Service {
  protected readonly loginTokenKey = cache.key('login-token', 'v1'); // [!code highlight]

  async getLoginToken(token: string) {
    return cache.get<{ userId: number; role: number }>(
      this.loginTokenKey.key(token),
    );
  }

  async setLoginToken(
    token: string,
    session: { userId: number; role: number },
  ) {
    await cache.set(this.loginTokenKey.key(token), session, '7 days');
  }

  async deleteLoginToken(token: string) {
    return cache.delete(this.loginTokenKey.key(token));
  }
}
```

From routes / auth:

```typescript
// after successful login
const token = auth.strategy('bearer').signature('sha256', user.id);
await services.user.setLoginToken(token, {
  userId: user.id,
  role: user.role,
}); // [!code highlight]

// in auth onLoaded
const session = await services.user.getLoginToken(token);
if (!session) {
  return false;
}

// on logout
await services.user.deleteLoginToken(token);
```

## Choosing an adapter

The adapter decides where data lives: **memory** is zero-dep, in-process, cleared on restart (local + unit tests); **Redis** shares session / counters across instances; **file** adds light disk persistence. Business code usually only changes the adapter passed at construction; the read/write API stays the same.

Local / tests with `@aomex/cache/memory`:

```typescript
import { Caching } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export const cache = new Caching(new CacheMemoryAdapter());
```

Production or multi-instance session / rate limits with `@aomex/cache-redis-adapter` (`ioredis` ships with the package):

```typescript
import { Caching } from '@aomex/cache';
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

export const cache = new Caching(
  new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 }),
);
```

Single-node light persistence: `@aomex/cache/file`.

## Building keys: CacheKey

`cache.key(...)` (or static `CacheKey.key(...)`) returns a **`CacheKey`**, not a plain string: segments join with `:`, and you can chain `.key` / `.keyHash` / `.toHash()`. `cache.get` / `set` accept it directly—no `String(...)`.

```typescript
cache.key('user', 1); // user:1
cache.key('user').key(1); // same
cache.key('user').keyHash(1); // user:<md5('1')>, readable prefix
cache.key('user', 1).toHash(); // <md5('user:1')>
cache.keyHash('user', 1); // same, full-key hash
```

| Form | Result |
| --- | --- |
| `cache.key('a', 1)` | Readable `a:1` |
| `prefix.key(id)` | Append one segment to an existing `CacheKey` |
| `cache.key('a').keyHash(id)` | Keep prefix, **hash only this call’s args** |
| `cache.key(...).toHash()` / `cache.keyHash(...)` | **Whole** MD5, no readable prefix |

Hash long / odd / secret segments; keep readable prefixes for day-to-day keys. The old standalone `hash()` is gone—use the forms above.

### Prefixes and versions

Centralize prefixes (e.g. `login-token`) with `protected readonly` on the Service, then `.key(token)` / `.key(id)` in methods. Bumping `v1` → `v2` in the prefix retires old sessions without name clashes:

```typescript
protected readonly loginTokenKey = cache.key('login-token', 'v2');
```

## DurationInput

You do not need raw `60_000` everywhere. `set` / `setNX` / `expire`, and `@remember`’s `duration`, accept:

- **number**: milliseconds (as before)
- **string**: digits + unit, spaces optional—`'30m'`, `'1 hour'`, `'7 days'`

Common units: `ms` / `s` (`sec` / `second`) / `m` (`min` / `minute`) / `h` (`hr` / `hour`) / `d` (`day`) / `w` (`week`) / `month` / `y` (`year`). `month` = 30 days, `year` = 365 days. Or `import { parseDuration } from '@aomex/common'` elsewhere.

```typescript
await cache.set(key, session, '7 days');
await cache.setNX(lockKey, '1', '30 seconds');
await cache.expire(key, '1 hour');
```

## exists: presence only

When you only need “is the key there?” without decoding the value, use `exists`. Returns `boolean`; accepts string or `CacheKey`.

```typescript
const key = loginTokenKey.key(token);
if (await cache.exists(key)) {
  // session still present; decide whether to get details
}
```

Unlike `get` (miss → `null` plus deserialize), `exists` only asks the adapter. Good for markers, locks, or probing before loading a large value.

::: tip
Between `exists` and `get` another writer may delete or change the key—do not treat it as a transaction. Use `setNX` for locks / idempotency; one-shot consume is `getAndDelete`.
:::

## getAndDelete: read once

For Redis-style `GETDEL` / one-shot credentials, use `getAndDelete`: atomic get + delete. Concurrent callers: only one gets the value; others see `null` (or your default).

Typical uses: OAuth `state`, email codes, short download tickets—once read, it must die to stop replay.

```typescript
const ticket = await cache.getAndDelete<{ userId: number }>(
  cache.key('email-verify', code),
);
if (!ticket) {
  ctx.throw(400, 'invalid or used code');
}
// ticket.userId is usable; the key is gone
```

`get` then `delete` leaves a window for a second reader; `getAndDelete` finishes in one adapter call. Optional second arg is the default on miss (same typing as `get`).

## setNX and counters

`setNX` writes only when the key is missing—distributed locks / “handle once”. TTL must cover the worst-case job, or a second worker may grab the lock. `increment` / `expire` fit OTP failure counts and fixed windows.

Lock / idempotency (TTL > worst job time):

```typescript
const ok = await cache.setNX(lockKey, '1', '30 seconds');
if (!ok) {
  return;
}
```

OTP failures: `increment` first, then `expire` when count is 1 (or TTL was never set)—same habit as Redis `INCR`. Memory adapter keeps existing TTL across incr/decr.

```typescript
const key = cache.key('otp-fail', phone);
const n = await cache.increment(key);
if (n === 1 || (await cache.ttl(key)) === -1) {
  await cache.expire(key, '15 minutes'); // [!code highlight]
}
if (n > 5) {
  ctx.throw(429);
}
```

## singleFlight: one compute under concurrency

When many callers need the same “compute now” result (JWKS fetch, expensive API) without long-term caching, use `singleFlight`: the first runs `factory`, others wait for the shared result; **nothing is kept after the flight**, so the next call computes again.

```typescript
async function loadJwks() {
  return cache.singleFlight(cache.key('jwks'), async () => { // [!code focus:3]
    return fetchJwksFromIdp();
  });
}
```

vs `@remember`: `remember` = single-flight + **write with `duration`**; `singleFlight` = **this concurrency wave only**. Lock ~30s with renewals; waiters see the same error on failure. If the winner crashes without writing, waiters compete again (with a round cap).

::: tip
Across instances the key must live on a shared adapter (e.g. Redis); in-process memory only protects the current process.
:::

## Cache decorator

Repeating get → miss → compute → set is noisy, and concurrent hits on one key recompute many times. `createRemember` builds `@remember`: hit returns immediately; miss runs the original method once and writes; **same key under concurrency runs once**, others wait (~30s placeholder lock, same idea as `singleFlight`).

Bind the decorator to a concrete **`Caching` instance**—`createRemember(cache)`, not an adapter or class constructor. Export it from `cache.ts`, then import `remember` in business Services:

```typescript
import { Caching, createRemember } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export const cache = new Caching(new CacheMemoryAdapter());
export const remember = createRemember(cache); // [!code highlight]
```

Connection is lazy inside `Caching`.

### On a business method

The method must be **async** (return a Promise). Duration alone means “how long to cache” (`DurationInput`):

```typescript
import { Service } from '@aomex/common';
import { remember } from '@/cache';

class ReportService extends Service {
  @remember('1 minute')
  async build(id: number) {
    return heavyCompute(id);
  }
}
```

Pass an object for a custom key or default. First `await services.report.find(1)` hits the DB; same args inside the window read cache. `duration` is still the write TTL:

```typescript
class ReportService extends Service {
  @remember({ // [!code focus:8]
    duration: '1 minute',
    key: (id) => {
      return `report:${id}`;
    },
    defaultValue: null,
  })
  async find(id: number) {
    return db.report.find(id);
  }
}
```

| Form | Role |
| --- | --- |
| `@remember('1 minute')` / `@remember(60_000)` | TTL only; default key rule |
| `duration` | Required in object form; how long to keep |
| `key: 'fixed'` | One key for the whole method (no args / site singleton) |
| `key: (...args) => string` | Key from args; `this` is still the instance |
| `defaultValue` | When the method returns `null`, callers see this (default still `null`) |

### Default key shape

Without `key`, the framework uses:

`class name or displayName` + `-` + `method name` + `-` + `JSON.stringify(args)`

Classes extending `Service` whose name ends with `Service` use `displayName` without the suffix (`ReportService` → `Report`). Args go through JSON—**avoid non-serializable or jittery values** (`Date`, cycles, fresh object literals), or keys never match. Prefer an explicit `key` when args are messy.

### Concurrency and null results

The first caller `setNX`s a ~30s placeholder (renewed while running); others poll until it drops, then read cache (or `defaultValue`). This is stampede protection, not a general distributed lock—use `singleFlight` when you only need shared compute without long-term cache.

A `null` return is **not** written (avoids locking “missing” too long); callers see `defaultValue`. To cache an explicit miss, design your own key or call `cache.set` by hand.

### Multiple caches

Local memory plus shared Redis: one `new Caching(adapter)` each, one `createRemember` each. Scope is per **instance**; there is no `fork()`. Whichever `remember` you attach picks the store.

::: warning
Only decorate **read-heavy, briefly stale-OK** queries. Do not decorate writes, SMS, or inventory decrements—cache would serve stale side effects. On change, `cache.delete` the key or bump the key version (see “Building keys”).
:::

## Next

- Service registration and lifecycle: [Services](/en/core/service)
- OAuth `state` and `store`: [OAuth2 client](/en/plugins/oauth2-client)
- Abuse `store`: [Abuse protection](/en/plugins/abuse)
- Sessions in auth: [Auth entry](/en/plugins/auth)
- Bearer / token strategies: [Bearer strategy](/en/plugins/auth-bearer-strategy)
