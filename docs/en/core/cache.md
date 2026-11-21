# Cache

Build a **CacheService**: pick a memory / file / Redis adapter, read and write with `this.cache`, and walk through the full login **session** flow (token → user info)—issue token, read on auth, delete on logout.

Subclass `createAdapter()`; use `protected readonly` plus `this.key(...)` for business prefixes that become `CacheKey` values, then chain `.key(token)` inside methods so strings do not scatter.

```typescript
import { BaseCacheService } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export default class CacheService extends BaseCacheService { // [!code focus:28]
  protected readonly loginTokenKey = this.key('login-token', 'v1');

  protected createAdapter() {
    return new CacheMemoryAdapter(); // [!code highlight]
  }

  async getLoginToken(token: string) {
    return this.cache.get<{ userId: number; role: number }>(
      this.loginTokenKey.key(token),
    );
  }

  async setLoginToken(
    token: string,
    session: { userId: number; role: number },
  ) {
    await this.cache.set(
      this.loginTokenKey.key(token),
      session,
      '7 days',
    );
  }

  async deleteLoginToken(token: string) {
    await this.cache.delete(this.loginTokenKey.key(token));
  }
}
```

`get` / `set` / `delete` accept **string or `CacheKey`**. With a generic on `get<T>(key)`, the return type is `T | null`; expiry on `set` / `setNX` / `expire`, and on `@remember`'s `duration`, is **`DurationInput`**: milliseconds or readable strings (`'7 days'`, `'30m'`, `'1.5 hours'`)—see below. Method names and parameters on `services.cache.xxx` match what you declare on `CacheService`; change a signature and the compiler nudges routes and auth callbacks too.

Register and warm up (use `eager` in production when switching to Redis):

```typescript
await combineServices(
  {
    cache: () => import('./cache.service.js'),
  },
  { eager: ['cache'] }, // [!code highlight]
);
```

::: warning
In production or with multiple instances, if cache is not in `eager`, the first cache read pays Redis connection latency and tail latency can spike.
:::

## Session read/write

After login issues a token, write「token → user info」to the cache; read it back in auth `onLoaded`; `delete` on logout. Use a versioned `CacheKey` prefix for key names—change one place on release to invalidate the whole batch when session shape changes.

Business side (login / auth / logout):

```typescript
// 登录成功后写入
const token = auth.strategy('bearer').signature('sha256', user.id);
await services.cache.setLoginToken(token, {
  userId: user.id,
  role: user.role,
}); // [!code highlight]

// 鉴权 onLoaded 里读取
const session = await services.cache.getLoginToken(token);
if (!session) {
  return false;
}

// 退出登录删掉
await services.cache.deleteLoginToken(token);
```

Keep token issuance and DB lookups in User / Auth services; `CacheService` only stores and retrieves.

## Choosing an adapter

The adapter decides where data lives: **memory** has zero deps, is in-process, and clears on restart—good for local dev and unit tests; **Redis** shares sessions and rate-limit counters across instances; **file** if you want a bit of disk persistence. Business code usually only changes `createAdapter()`; the read/write API stays the same.

Local dev and tests with `@aomex/cache/memory`, zero deps, data lost on restart:

```typescript
import { CacheMemoryAdapter } from '@aomex/cache/memory';

protected createAdapter() {
  return new CacheMemoryAdapter();
}
```

Production or multi-instance session / rate limiting—swap in `@aomex/cache-redis-adapter` (`ioredis` ships with the package; you typically only change `createAdapter()`):

```typescript
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

protected createAdapter() {
  return new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 });
}
```

Single-machine persistence with light disk use: `@aomex/cache/file`.

## How keys compose: CacheKey

`this.key(...)` returns **`CacheKey`**, not a plain string: segments join with `:`, and you can keep chaining `.key` / `.keyHash` / `.toHash()`. `this.cache.get` / `set` and friends accept it directly—no need to `String(...)`.

```typescript
this.key('user', 1); // user:1
this.key('user').key(1); // 同上
this.key('user').keyHash(1); // user:<md5('1')>，前缀可读
this.key('user', 1).toHash(); // <md5('user:1')>
this.keyHash('user', 1); // 同上，整键哈希
```

| Form | What you get |
| --- | --- |
| `this.key('a', 1)` | Readable key `a:1` |
| `prefix.key(id)` | Append another segment on an existing `CacheKey` prefix |
| `this.key('a').keyHash(id)` | Keep the prefix; **hash only this argument** |
| `this.key(...).toHash()` / `this.keyHash(...)` | **Full** MD5, no readable prefix |

Use hashing when a segment is long, has odd characters, or you do not want plaintext in Redis; for day-to-day keys, a readable prefix makes debugging easier. The old standalone `hash()` is removed—use the patterns above.

### Prefixes and versions

`protected readonly` fields centralize business prefixes (e.g. `login-token`); inside methods chain `.key(token)` / `.key(id)` instead of magic strings everywhere. Putting a version in the prefix (`v1` → `v2`) retires old sessions **without renaming keys**:

```typescript
protected readonly loginTokenKey = this.key('login-token', 'v2');
```

## DurationInput

You no longer need to hand-write `60_000`. `set` / `setNX` / `expire`, and `@remember`'s `duration`, all accept:

- **number**: milliseconds (same as before)
- **string**: number + unit, optional space—`'30m'`, `'1 hour'`, `'7 days'`

Common units: `ms` / `s` (`sec` / `second`) / `m` (`min` / `minute`) / `h` (`hr` / `hour`) / `d` (`day`) / `w` (`week`) / `month` / `y` (`year`). A `month` is 30 days, a `year` is 365 days. You can also `import { parseDuration } from '@aomex/common'` to turn readable durations into milliseconds elsewhere.

```typescript
await this.cache.set(key, session, '7 days');
await this.cache.setNX(lockKey, '1', '30 seconds');
await this.cache.expire(key, '1 hour');
```

## exists: just presence

When you only need to know whether a key **is present**—without reading and decoding the value—use `exists`. It returns a `boolean` and accepts a string or `CacheKey`.

```typescript
const key = this.loginTokenKey.key(token);
if (await this.cache.exists(key)) {
  // session still present — decide whether to get details
}
```

Compared to `get`: on a miss, `get` returns `null` (you still judge that yourself) and deserializes the value; `exists` only asks the adapter whether the key is still there. Good for placeholder flags, whether a lock is still held, or probing before pulling a large object.

::: tip
Between「exists then get」another client may delete or change the key—do not treat it as a strict transactional condition. For lock grabs and idempotency, still use `setNX` below.
:::

## setNX and counters

`setNX` writes only when the key is missing—use for distributed locks and idempotent「process once」. TTL must cover worst-case task time or another worker can take the lock after expiry. `increment` / `expire` suit captcha failure counts and sliding-window tallies.

Lock grab, idempotency (TTL greater than worst-case task time):

```typescript
const ok = await this.cache.setNX(lockKey, '1', '30 seconds');
if (!ok) {
  return;
}
```

Failed verification attempts: `increment` first, then `expire` on the first hit (or when TTL is not set yet)—same habit as Redis `INCR`. On the memory adapter, `increment` / `decrement` **keep the existing TTL** instead of clearing expiry when the number changes.

```typescript
const key = this.key('otp-fail', phone);
const n = await this.cache.increment(key);
if (n === 1 || (await this.cache.ttl(key)) === -1) {
  await this.cache.expire(key, '15 minutes'); // [!code highlight]
}
if (n > 5) {
  ctx.throw(429);
}
```

## Cache decorator

Repeating「get → miss → compute → set」in every method is noisy, and concurrent hits on the same key recompute many times. `createRemember` builds a method decorator `@remember`: cache hit returns immediately; on miss only the original method runs and writes; **for the same key under concurrency, only one execution runs**, the rest wait for the result.

Bind the decorator to **your** cache service class—pass the **subclass constructor** of `BaseCacheService` (not the base class, not an instance). Defining it in `cache.service.ts` is simplest; business code imports `remember`:

```typescript
import { BaseCacheService, createRemember } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export default class CacheService extends BaseCacheService {
  protected createAdapter() {
    return new CacheMemoryAdapter();
  }
}

export const remember = createRemember(CacheService); // [!code highlight]
```

After `BaseCacheService` connects the adapter in `onInit`, remember is wired automatically and torn down on shutdown—you **do not** register it by hand. Still use `eager: ['cache']` in `combineServices`: if cache is not ready, decorated methods **wait**; after shutdown, calls **throw**.

### Apply to business methods

The method must be **async** (return a `Promise`). Passing only a duration means “how long to cache” (`DurationInput`):

```typescript
import { Service } from '@aomex/common';
import { remember } from './cache.service.js';

class ReportService extends Service {
  @remember('1 minute')
  async build(id: number) {
    return heavyCompute(id);
  }
}
```

To customize the key or default value, pass an object. The first `await services.report.find(1)` hits the DB; later calls with the same args within the window read the cache. `duration` is how long the entry lives after write:

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

| Form | Purpose |
| --- | --- |
| `@remember('1 minute')` / `@remember(60_000)` | TTL only; default key rule |
| `duration` | Required (object form); how long to cache |
| `key: 'fixed-string'` | One key for the whole method (no args, site-wide singleton result) |
| `key: (...args) => string` | Key from args; `this` is still the business instance |
| `defaultValue` | When the original method returns `null`, callers see this instead (default `null`) |

### Default key composition

Without `key`, the framework uses:

`class name or displayName` + `-` + `method name` + `-` + `JSON.stringify(arguments)`

If you extend `Service` and the class name ends with `Service`, it uses `displayName` without the suffix (`ReportService` → `Report`) so keys are not cluttered. Args go through JSON—**do not pass non-serializable or unstable values** (`Date`, circular refs, new object literals every call) or keys will not match and caching is effectively off. For many or messy args, a custom `key` is safer.

### Concurrency and empty results

Concurrent calls on the same key: the first uses `setNX` to reserve and run the original method; the placeholder lasts ~20s and renews while running; others poll until it clears, then read cache (or get `defaultValue`). This prevents cache stampede, not general distributed locking—do not use it as a generic lock.

When the original method returns `null`, **`null` is not written** (so「missing」is not frozen too long); callers see `defaultValue`. To cache an explicit「not found」, design keys yourself or use hand-written `this.cache.set`.

### Multiple cache backends

Local memory in one service, shared Redis in another: one `BaseCacheService` subclass each, one `createRemember` each. Scope is per **service class**; there is no `fork()`. Whichever `remember` you attach decides which store is used.

::: warning
Use only on **read-heavy, write-light** queries that can go slightly stale. Do not decorate methods with side effects—writes, SMS, stock deductions—cached rows will be stale. When data changes, `cache.delete` the key or bump key version (see key composition above).
:::

## Next steps

- Service registration and `eager`: [Service layer](/en/core/service)
- `store` for abuse counters: [Abuse protection](/en/plugins/abuse)
- Using session in auth: [Auth entry point](/en/plugins/auth)
- Bearer and token strategies: [Bearer strategy](/en/plugins/auth-bearer-strategy)