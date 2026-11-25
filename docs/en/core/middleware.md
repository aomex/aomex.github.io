# Middleware

Run logic when a request enters and optionally after the handler finishes, and expose fields on `ctx` for downstream actions (e.g. `requestId`).

A middleware is a function: call `await next()` so the request continues; you can run code before and after `next`.

```typescript
import { middleware } from '@aomex/common';

export const withRequestId = middleware.mixin<{
  readonly requestId: string;
}>(async (ctx, next) => { // [!code highlight]
  ctx.requestId = crypto.randomUUID();
  await next();
});
```

::: warning
Later middleware and handlers depend on `await next()`. You may skip `next()` to cut off after auth failure, but do not forget it by accident. Always **await next()** or downstream async errors become unhandled rejections.
:::

After `middleware.mixin<{ … }>` declares new `ctx` fields, **later middleware and the route action** get autocomplete for those properties. Assign at runtime without the generic and TypeScript still thinks they do not exist.

```typescript
import { logger } from '@/services/logger.service';

// in the action
async (ctx) => { // [!code highlight]
  logger.info(`request ${ctx.requestId}`);
  return { ok: true };
};
```

Multiple middleware mixins merge onto the same `ctx` type. Runtime-only fields without a mixin generic work at runtime but not in the type checker—easy to miss renames.

## WebApp.mount

`WebApp.mount` is the site-wide onion stack: CORS, access log, `formatError`, `routers(...)` run in array order. Earlier entries wrap everything after `await next()`.

```typescript
import { WebApp } from '@aomex/web';
import { routers } from '@aomex/web';
import { withRequestId } from '@/middlewares/request-id';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:2]
    withRequestId, // [!code highlight]
    routers('./src/routers'),
  ],
});
```

Put “every request needs this” work—CORS, site-wide `requestId`, access logs—on `WebApp.mount` / `ConsoleApp.mount`.

## Router.mount

Use `Router({ mount })` when a URL group shares logic (auth, audit, prefix-level `formatError`) without wrapping the whole site in `WebApp`.

```typescript
import { Router } from '@aomex/web';

// every resource in this group requires login (auth = configured Auth instance)
new Router({ prefix: '/admin', mount: [auth.authenticate('bearer')] });
```

Use `Router.mount` for class-wide auth; split another Router for public routes (do not sprinkle `skip` on one router).

## Per-route mount

A route’s `mount` runs only before that action: route-specific body/query, stricter `authorize`, exceptions beside public routes on the same Router. Prefer built-in `query` / `body` / `cors` / `auth` over custom middleware for everyday validation.

```typescript
import { rule } from '@aomex/common';
import { body } from '@aomex/web';

router.post('/login', { // [!code focus:11]
  mount: [
    body({ // [!code highlight]
      email: rule.email(),
      password: rule.string(),
    }),
  ],
  action: async (ctx) => {
    ctx.send({ token: '...' });
  },
});
```

## Skip certain requests

When few paths or environments should skip full middleware (health checks without auth, turning off a layer in test), chain `.skip(...)` on existing middleware: if the condition is `true`, it calls `next()` without running the original logic—easier than duplicating `mount`.

You can pass a **function** (per-request) or a plain **`boolean`** (decide at compile time whether to skip):

```typescript
const authMaybe = auth.authenticate('bearer').skip((ctx) => { // [!code highlight]
  return ctx.request.pathname === '/health';
});

// Turn off the whole layer in test—no wrapper function needed
const accessLogMaybe = accessLog().skip(process.env['NODE_ENV'] === 'test');

// Temporarily disable a layer (same as omitting it from mount)
someMiddleware.skip(true);
```

::: warning
`.skip()` does **not** change Props types: when auth is skipped, `ctx.auth` still looks present in types—handle unauthenticated branches in the action yourself. With many public endpoints, prefer a separate unauthenticated Router over chaining skips on auth.
:::

## Borrow upstream types with `dependsOn`

When writing middleware you **assume** an upstream layer already ran (auth, middleware with `userId`, etc.) and you want those fields on `ctx` in `fn` without executing upstream again—use `middleware.dependsOn(upstream).web(...)` / `.mixin(...)` / `.console(...)`.

`dependsOn` is **type-only**: it does not run the middleware you pass in; execution still depends on mount order and the real upstream entry.

```typescript
import { middleware } from '@aomex/common';

const withUser = middleware.web<{ userId: number }>(async (ctx, next) => {
  ctx.userId = Number(ctx.request.headers['x-user-id']);
  await next();
});

// Assume withUser is mounted above: ctx.userId completes here without re-running withUser
export const loadProfile = middleware.dependsOn(withUser).web(async (ctx, next) => { // [!code highlight]
  const profile = await services.user.getProfile(ctx.userId);
  ctx.send(profile);
  await next();
});
```

Still mount upstream before this layer:

```typescript
router.get('/me', {
  mount: [withUser, loadProfile], // [!code highlight]
  action: async () => {},
});
```

You may pass a factory or `async` factory (like lazy `combineServices`—still type-only here). Chain multiple `dependsOn` calls and fields stack.

::: tip
`Middleware.Infer<typeof loadProfile>` does **not** include Props borrowed via `dependsOn`—externally it still looks like this middleware adds nothing to `ctx`. Borrowing only affects `ctx` inside `fn` (and the first `.skip(ctx => …)` right after).
:::

Prefer built-in query, body, cors, and auth middleware; for OpenAPI / CLI help hooks see [Custom middleware](/en/advanced/middleware).

## Next steps

- Validation and 400 copy: [Request body](/en/web/body), [Query string](/en/web/query)
- Auth middleware: [Auth](/en/plugins/auth)
- OpenAPI / Help hooks: [Custom middleware](/en/advanced/middleware)