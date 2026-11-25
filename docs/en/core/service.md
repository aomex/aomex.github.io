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

Register with a factory + `combineServices`; put **services that must connect at process start** in `eager` (Prisma / external SDKs):

```typescript
import { combineServices } from '@aomex/common';

export const services = await combineServices( // [!code highlight]
  {
    user: () => import('@/services/user.service'),
  },
  { eager: ['user'] },
);
```

After wiring into Web, `services` types come from `combineServices` keys and each Service’s **public methods**: `await services.user.findById(1)` gets full arg/return completion; `onInit`, `onDestroy`, and `private` fields **do not** appear on `services.user`. Synchronous Service methods are still typed as **Promise** from the outside—use `await` consistently.

```typescript
import { WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services, // [!code highlight]
  logger,
  language: { mode: 'fixed', language: 'en-US' },
  proxyIP: { mode: 'detect' },
});
```

::: tip
Do not `new UserService()` in business code without passing it through `WebApp` / `ConsoleApp` `services`—on shutdown the framework cannot close connections you created outside the bag.
:::

In routes or middleware:

```typescript
import { logger } from '@/services/logger.service';

const user = await services.user.findById(1);
logger.info(`User queried ${user?.name ?? ''}`);
```

Import `{ services } from '@/services'` elsewhere—no extra module augmentation needed.

## Lazy loading and test injection

In production use `() => import('@/services/xxx.service')` to defer load and speed cold start:

```typescript
user: () => import('@/services/user.service'),
```

In tests, inject fakes with an async factory that returns the class:

```typescript
user: async () => FakeUserService,
```

::: warning
Do not write `async () => UserService` in production code—the class is already loaded with the module, so «lazy» does nothing and wastes memory. Production always uses `() => import('@/services/user.service')`; the async form is for test injection only.
:::

`export default class XxxService` per file is simplest—the loader does not have to guess among exports.

## eager

By default services are **lazy**: first `await services.xxx` instantiates and runs `onInit`. Names in `eager` are built before `combineServices` returns—good for business services that must connect when the process starts (e.g. Prisma).

```typescript
{ eager: ['user', 'prisma'] },
```

Local smoke tests or minimal CLI can skip `eager`. If A’s `onInit` does `await services.user.xxx` and user is not eager, init slides to the first business call and startup ordering gets fragile. ## Lifecycle hooks

Some resources do not live in the `services` bag (module-level `PrismaClient`, plugin-internal Redis stores) but still need connect on start and disconnect on shutdown. Use `registerLifecycle`: `onInit` runs when you register; `WebApp` / `ConsoleApp` runs `onDestroy` on shutdown.

For lazy connect (adapters, custom clients), the usual pattern is a latch that clears on failure so the next call can retry—this helper does **not** retry by itself:

```typescript
import { registerLifecycle } from '@aomex/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let ready: Promise<void> | undefined;

function ensureReady() {
  ready ??= registerLifecycle({ // [!code focus:7]
    onInit: () => prisma.$connect(),
    onDestroy: () => prisma.$disconnect(),
  }).catch((err) => {
    ready = undefined;
    throw err;
  });
  return ready;
}
```

One-shot connect (boot scripts, module top-level) can still `await registerLifecycle({ … })`. The returned function **unregisters** early (no-op if already shut down or cancelled). If `onInit` fails, nothing is queued for destroy. Rate-limit and similar plugins use the same hooks—you usually do not register those again in app code.

Classes already in `combineServices` keep using `onInit` / `onDestroy`; no need to wrap them in `registerLifecycle`.

## Merging multiple bags

Large repos split domains into several `combineServices` results and pass an array to the app:

```typescript
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services: [domainA, domainB], // [!code highlight]
  logger,
  language: { mode: 'fixed', language: 'en-US' },
  proxyIP: { mode: 'detect' },
});
```

When the class name ends with `Service`, [`createRemember`](/en/core/cache#cache-decorator) and similar use the name without the suffix for cache keys (`UserService` → `User`).

Calling across services: inside a class `import { services } from '@/services'` and `await services.other.method()`. Use `this.foo()` within the class; **cross-class** calls use `await services.other.foo()`.

## Next steps

- Shared `Caching` and `createRemember`: [Cache](/en/core/cache)
- Site-wide `Logger`: [Logging](/en/core/logger)
- Thin routes: [Router](/en/web/router)
