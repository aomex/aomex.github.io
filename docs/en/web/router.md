---
outline: deep
---

# HTTP routing

Split `src/routers` by domain; each file exports a `Router`, registers actions with `get` / `post`; mount once with `routers('./src/routers')` on `WebApp.mount`.

```typescript
// src/routers/user.ts
import { Router } from '@aomex/web';

export const router = new Router();

const users = [
  { id: 1, name: 'Ada' },
  { id: 2, name: 'Bob' },
];

router.get('/users', { // [!code focus:5]
  action: async (ctx) => {
    ctx.send(users);
  },
});

router.get('/users/count', {
  action: async (ctx) => {
    ctx.send({ count: users.length });
  },
});
```

Mount on the app:

```typescript
import { routers, WebApp } from '@aomex/web';

new WebApp({
  // services, logger, language, proxyIP …
  mount: [routers('./src/routers')], // [!code highlight]
});
```

For tests or feature flags, pass instances instead of scanning a directory:

```typescript
import { userRouter } from './routers/user.js';
import { postRouter } from './routers/post.js';

mount: [routers([userRouter, postRouter])],
```

After `query()` / `body()` / `params()` / `response()` on a route `mount`, the action `ctx` merges those types. **Per-method** `mount` affects only that route; **router-level** `Router({ mount: [...] })` affects every method in the file.

```typescript
router.get('/users', { // [!code focus:11]
  mount: [
    middleware.web<{ tenant: string }>(async (ctx, next) => { // [!code highlight]
      ctx.tenant = ctx.request.headers['x-tenant'] as string;
      await next();
    }),
  ],
  action: (ctx) => {
    ctx.tenant;
  },
});

router.get('/users/:id', {
  action: (ctx) => {
    ctx.tenant; // not in types
  },
});
```

## prefix

`Router({ prefix })` prepends a fixed segment to **every** path in the file—avoid repeating `/users` on each `router.get`. Version switches (`/v1` → `/v2`) or domain URLs change in one constructor argument.

```typescript
import { rule } from '@aomex/common';
import { params, Router } from '@aomex/web';

export const router = new Router({ prefix: '/users' }); // [!code highlight]

router.get('/', { // [!code focus:5]
  action: async (ctx) => {
    ctx.send([]);
  },
});

router.get('/:id', {
  mount: [params({ id: rule.int().min(1) })],
  action: async (ctx) => {
    ctx.send({ id: ctx.params.id });
  },
});
```

Final path = prefix + registered uri (extra slashes normalize). When debugging 404, assemble the full path with prefix—not only `router.get('/:id')`.

OpenAPI grouping: `Router({ docs: { tags: ['User'] } })`; per-route `docs.summary` can override.

## Router-level mount

`Router({ mount: [...] })` applies middleware to **all** methods in the file—group login, audit, or shared query defaults here instead of repeating per `router.get`.

```typescript
new Router({
  prefix: '/admin',
  mount: [auth.authenticate('bearer')],
});
```

Router-level mount hits **every** method in the file—split public routes to another file or use per-method mount / `skip`.

## Per-route mount, docs, disabled

**Per-method mount** applies to one route: input validation (`query` / `body` / `params` / `response`), per-route auth, etc. With router-level mount, router-level runs first, then method-level.

**disabled** skips registration at runtime (no match, no action)—env flags or feature toggles for half-built endpoints beat leaving 501 in production.

**docs** sets OpenAPI text (`summary`, etc.). `Router({ docs: { tags } })` groups; route `docs` override titles/descriptions—scanned with [response()](/en/web/response). See [OpenAPI plugin](/en/plugins/openapi).

```typescript
import { rule } from '@aomex/common';
import { query, response, Router } from '@aomex/web';

router.get('/users', { // [!code focus:11]
  disabled: process.env['FEATURE_USERS'] !== '1', // [!code highlight]
  mount: [
    query({ page: rule.int().min(1).default(1) }),
    response({ statusCode: 200, content: rule.array({ id: rule.int() }) }),
  ],
  docs: { summary: 'List users' }, // [!code highlight]
  action: async (ctx) => {
    ctx.send([]);
  },
});
```

Single path param:

```typescript
router.get('/users/:id', {
  mount: [params({ id: rule.int().min(1) })], // [!code highlight]
  action: async (ctx) => {
    ctx.send({ id: ctx.params.id });
  },
});
```

Without `params()`, `ctx.request.params` are all strings—`"1"` vs `1` confuses business logic.

## HTTP methods

Each `router.<method>(uri, { ... })` binds one verb; registration order does not affect matching—static segments still beat `:param`.

| Method | Notes |
| --- | --- |
| `get` | `GET`; **HEAD** shares the same match as `GET` |
| `post` / `put` / `patch` / `delete` | Matching verbs |
| `all` | All of the above |
| `customize` | Custom verb array |

`customize` accepts multiple verbs on one path (GET probe + POST ack)—separate `get`/`post` duplicates routes. Common for webhooks and health checks:

```typescript
router.customize(['GET', 'POST'], '/webhook', { // [!code highlight]
  action: async (ctx) => {
    ctx.send({ ok: true });
  },
});
```

## Path patterns

Literal segments beat `:param`, so `/users/count` is not swallowed by `/:id`. Param names must match `params()` keys.

| Pattern | Meaning |
| --- | --- |
| `/users/:id` | Named param `id` |
| `/users/count` alongside `/users/:id` | Literal wins; do not rely on order—use static segments when you can |

When glob-scanning directories, keep only `Router` exports—extra files make “why is this not registered?” hard.

## Next steps

- [Web app entry](/en/web/): `WebApp` and site-wide `mount`
- [Query string](/en/web/query): GET filters and pagination
- [Path parameters](/en/web/params), [Request body](/en/web/body)