# Services

Move “query DB, call third parties, read/write cache” out of route actions into reusable **Service** classes; **`combineServices`** builds a typed `services` bag used the same way in Web, Console, and Cron.

Business classes extend `Service`, expose only public async methods; connect/warm-up in `onInit`, teardown in `onDestroy` (keep those `protected`—do not expose them).

```typescript
import { Service } from '@aomex/common';

export default class UserService extends Service {
  private cache = new Map<number, { name: string }>();

  protected override async onInit(): Promise<void> { // [!code highlight]
    // warm connections, load config…
  }

  protected override async onDestroy(): Promise<void> {
    this.cache.clear();
  }

  async findById(id: number) {
    return this.cache.get(id) ?? null;
  }
}
```

Register with factory + `combineServices`; **put infrastructure in `eager`** so connections are ready at boot, not on first production request:

```typescript
import { combineServices } from '@aomex/common';

export const services = await combineServices( // [!code highlight]
  {
    user: () => import('./user.service.js'),
    cache: () => import('./cache.service.js'),
    logger: () => import('./logger.service.js'),
  },
  { eager: ['cache', 'logger'] },
);
```

On Web, `services` types come from `combineServices` keys and each Service’s **public methods**: `await services.user.findById(1)` gets full param/return completions; `onInit`, `onDestroy`, and `private` fields **do not** appear on `services.user`. Sync Service methods are still typed as **Promise** from the outside—always `await`.

```typescript
import { WebApp } from '@aomex/web';

const app = new WebApp({
  services, // [!code highlight]
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

::: tip
Do not `new UserService()` in business code without passing it through WebApp / ConsoleApp `services`—shutdown will not run `onDestroy` and connections may leak.
:::

In routes or middleware:

```typescript
const user = await services.user.findById(1);
await services.logger.info('user fetched', { userId: user?.name });
```

`import { services } from './services/index.js'` elsewhere—no extra module augmentation needed.

## Lazy load and test injection

Production uses `() => import('./xxx.service.js')` for faster cold start:

```typescript
user: () => import('./user.service.js'),
```

Tests can inject fakes with an async factory returning the class:

```typescript
user: async () => FakeUserService,
```

::: warning
Do not write `async () => UserService` in production—the class is already in memory with the module, lazy load is pointless and wastes RAM. Production always `() => import('./user.service.js')`; the async-return-class pattern is for tests only.
:::

`export default class XxxService` per file keeps loaders simple.

## eager

Services default to **lazy**: first `await services.xxx` constructs and runs `onInit`. Names in `eager` build before `combineServices` returns—good for Redis, logging, anything that must be ready at process start.

```typescript
{ eager: ['cache', 'logger'] },
```

Local smoke tests or minimal CLI may omit `eager`. If A’s `onInit` calls `await services.cache.xxx` and `cache` is not eager, connect happens on first business call—easy timing bugs at startup.

## Merging bags

Large repos may `combineServices` per domain then pass an array to the app:

```typescript
const app = new WebApp({
  services: [domainA, domainB], // [!code highlight]
  logger: domainA.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

When the class name ends with `Service`, [@remember](/en/core/cache#method-decorator-remember) and similar use the name without the suffix for cache keys (`UserService` → `User`).

Cross-service calls: `import { services } from './index.js'` in the class, then `await services.other.method()`. Use `this.foo()` inside the class; **cross-class** use `await services.other.foo()`.

## Next steps

- Sessions and Redis: [Cache](/en/core/cache)
- Site-wide logging: [Logger](/en/core/logger)
- Thin routes: [HTTP routing](/en/web/router)