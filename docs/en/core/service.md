# Service layer

Move "query DB, call third parties, read/write cache" out of route actions into reusable **Service** classes; use **combineServices** to build one typed `services` bag and call the same names from Web, Console, and Cron.

Business classes extend `Service` and expose ordinary async methods; wire connections in `onInit`, release in `onDestroy` (keep those `protected`—do not expose them directly).

```typescript
import { Service } from '@aomex/common';

export default class UserService extends Service {
  private cache = new Map<number, { name: string }>();

  protected override async onInit(): Promise<void> { // [!code highlight]
    // Warm connections, load config…
  }

  protected override async onDestroy(): Promise<void> {
    this.cache.clear();
  }

  async findById(id: number) {
    return this.cache.get(id) ?? null;
  }
}
```

Register with a factory + `combineServices`; **put infrastructure in `eager`** so the app connects on startup, not on the first production request:

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

After wiring into Web, `services` types come from `combineServices` keys and each Service’s **public methods**: `await services.user.findById(1)` gets full arg/return completion; `onInit`, `onDestroy`, and `private` fields **do not** appear on `services.user`. Synchronous Service methods are still typed as **Promise** from the outside—use `await` consistently.

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
Do not `new UserService()` in business code without passing it through `WebApp` / `ConsoleApp` `services`—on shutdown the framework cannot close connections you created outside the bag.
:::

In routes or middleware:

```typescript
const user = await services.user.findById(1);
await services.logger.info('User queried', { userId: user?.name });
```

Import `{ services } from './services/index.js'` elsewhere—no extra module augmentation needed.

## Lazy loading and test injection

In production use `() => import('./xxx.service.js')` to defer load and speed cold start:

```typescript
user: () => import('./user.service.js'),
```

In tests, inject fakes with an async factory that returns the class:

```typescript
user: async () => FakeUserService,
```

::: warning
Do not write `async () => UserService` in production code—the class is already loaded with the module, so «lazy» does nothing and wastes memory. Production always uses `() => import('./user.service.js')`; the async form is for test injection only.
:::

`export default class XxxService` per file is simplest—the loader does not have to guess among exports.

## eager

By default services are **lazy**: first `await services.xxx` instantiates and runs `onInit`. Names in `eager` are built before `combineServices` returns—good for Redis, logging, and anything that must be ready when the process starts.

```typescript
{ eager: ['cache', 'logger'] },
```

Local smoke tests or minimal CLI can skip `eager`. If A’s `onInit` does `await services.cache.xxx` and cache is not eager, connect happens on first business call and startup ordering gets fragile.

## Lifecycle hooks

Some resources **should not** be Services or live in the `services` bag (module-level `PrismaClient`, plugin-internal Redis stores) but still need connect on start and disconnect on shutdown. Use `registerLifecycle`: `onInit` runs when you register; `WebApp` / `ConsoleApp` runs `onDestroy` on shutdown.

```typescript
import { registerLifecycle } from '@aomex/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

await registerLifecycle({ // [!code focus:4]
  onInit: () => prisma.$connect(),
  onDestroy: () => prisma.$disconnect(),
});
```

The returned function **unregisters** early (no-op if already shut down or cancelled). If `onInit` fails, nothing is queued for destroy. Rate limiting and other plugins use the same hooks for stores—you usually do not register those again in app code.

Classes already in `combineServices` keep using `onInit` / `onDestroy`; no need to wrap them in `registerLifecycle`.

## Merging multiple bags

Large repos split domains into several `combineServices` results and pass an array to the app:

```typescript
const app = new WebApp({
  services: [domainA, domainB], // [!code highlight]
  logger: domainA.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

When the class name ends with `Service`, [`createRemember`](/en/core/cache#cache-decorator) and similar use the name without the suffix for cache keys (`UserService` → `User`).

Calling across services: inside a class `import { services } from './index.js'` and `await services.other.method()`. Use `this.foo()` within the class; **cross-class** calls use `await services.other.foo()`.

## Next steps

- Sessions and `createRemember`: [Cache](/en/core/cache)
- Site-wide logging: [Logger](/en/core/logger)
- Thin routes: [Router](/en/web/router)