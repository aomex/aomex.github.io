# Cache

Build a **CacheService**: pick memory / file / Redis adapter, read/write via `this.cache`; wire login **session** (token → user) end to end—issue, auth read, logout delete.

Subclass implements `createAdapter()`; business keys as `protected readonly` + `this.concat`, not scattered strings.

```typescript
import { BaseCacheService } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export default class CacheService extends BaseCacheService { // [!code focus:28]
  protected readonly loginTokenKey = this.concat('login-token', 'v1');

  protected createAdapter() {
    return new CacheMemoryAdapter(); // [!code highlight]
  }

  async getLoginToken(token: string) {
    return this.cache.get<{ userId: number; role: number }>(
      this.concat(this.loginTokenKey, token),
    );
  }

  async setLoginToken(
    token: string,
    session: { userId: number; role: number },
  ) {
    await this.cache.set(
      this.concat(this.loginTokenKey, token),
      session,
      this.ttl.DAY * 7,
    );
  }

  async deleteLoginToken(token: string) {
    await this.cache.delete(this.concat(this.loginTokenKey, token));
  }
}
```

`get<T>(key)` with generic returns `T | null`; `set` third arg is TTL **milliseconds**—`this.ttl.DAY`, `this.ttl.MINUTE` reduce magic numbers. `services.cache.xxx` matches your `CacheService` methods—signature changes propagate to routes and auth callbacks.

Register and warm (especially with Redis in production):

```typescript
await combineServices(
  {
    cache: () => import('./cache.service.js'),
  },
  { eager: ['cache'] }, // [!code highlight]
);
```

::: warning
Production or multi-instance without `eager` on cache—first cache read pays connect cost and tail latency jitters.
:::

## Session read/write

After login issue token, store token → user; read in auth `onLoaded`; delete on logout. Version prefix in keys (`v1` → `v2`) invalidates old sessions when payload shape changes.

```typescript
// after login
const token = auth.strategy('bearer').signature('sha256', user.id);
await services.cache.setLoginToken(token, {
  userId: user.id,
  role: user.role,
}); // [!code highlight]

// in onLoaded
const session = await services.cache.getLoginToken(token);
if (!session) {
  return false;
}

// logout
await services.cache.deleteLoginToken(token);
```

Token issue and DB logic stay in User / Auth services; `CacheService` only stores.

## memory and Redis

Adapter chooses where data lives: **memory**—zero deps, in-process, cleared on restart (local/tests); **Redis**—shared sessions and rate limits across instances; **file**—light disk persistence. Business code usually only changes `createAdapter()`.

```typescript
import { CacheMemoryAdapter } from '@aomex/cache/memory';

protected createAdapter() {
  return new CacheMemoryAdapter();
}
```

```typescript
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

protected createAdapter() {
  return new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 });
}
```

Single-machine persistence: `@aomex/cache/file`.

## Key naming and versions

`protected readonly` prefixes (e.g. `login-token`), `this.concat` with token/id—avoid magic strings in methods. Version in prefix (`v1` → `v2`) retires old sessions without rename collisions.

```typescript
protected readonly loginTokenKey = this.concat('login-token', 'v2');
```

## setNX and counters

`setNX` writes only if missing—locks, idempotent “process once”; TTL must exceed worst task duration or another worker steals the lock. `increment` / `expire` for OTP failure counts, sliding windows.

```typescript
const ok = await this.cache.setNX(lockKey, '1', 30_000);
if (ok) {
  await this.cache.expire(lockKey, 30_000);
}
```

## @remember method decorator

Read-heavy, briefly cacheable queries on **business Service** methods—use `@remember` instead of hand get → miss → set. In `CacheService.onInit` call `remember.setInstance(this)` with `eager: ['cache']`; on shutdown `deleteInstance`.

```typescript
protected override async onInit() {
  await super.onInit();
  remember.setInstance(this); // [!code highlight]
}

protected override async onDestroy() {
  remember.deleteInstance(); // [!code highlight]
  await super.onDestroy();
}
```

```typescript
class ReportService extends Service {
  @remember(60_000)
  async build(id: number) {
    return heavyCompute(id);
  }

  @remember({ // [!code highlight]
    duration: 60_000,
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

::: warning
Do not use on mutating writes; you still invalidate via delete or key version. Caching writers returns stale data without a strategy.
:::

## Next steps

- Registration and eager: [Services](/en/core/service)
- Session in auth: [Authentication](/en/plugins/auth)
- Bearer tokens: [Bearer strategy](/en/plugins/auth-bearer-strategy)