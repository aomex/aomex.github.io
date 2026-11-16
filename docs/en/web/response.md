---
outline: deep
---

# Response constraints

Declare per route which status codes may return and what success bodies look like: mount `response()`. Does not change how data is sent, but narrows `ctx.send` / `ctx.throw` / `ctx.redirect` types and feeds OpenAPI. Declared 200 but `send(201)`—the compiler errors on purpose.

```typescript
import { rule } from '@aomex/common';
import { response, Router } from '@aomex/web';

export const router = new Router();

router.get('/me', { // [!code focus:19]
  mount: [
    response({ // [!code highlight]
      statusCode: 200,
      content: {
        id: rule.int(),
        name: rule.string(),
      },
    }),
    response({ statusCode: 404 }),
  ],
  action: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) {
      return ctx.throw(404, 'not found');
    }
    ctx.send({ id: user.id, name: user.name });
  },
});
```

Missing resource → `throw(404)`, success → `send`—do not `send(404)`. `response()` constrains compile time and docs—it does **not** re-validate `send` bodies at runtime.

With `200` `content`, `ctx.send({ id, name })` must match validator inference. After `response({ statusCode: 404 })`, `ctx.throw(404, …)` is a legal exit. **201** and other non-200 2xx need an **explicit status** in `send`; **204** use `ctx.send(204)` without `{}`. **3xx** use `ctx.redirect(status, url)`. Multiple `response()` mounts cover success and error exits.

| Status | How you send |
| --- | --- |
| `200` | `send(body)` or `send(200, body)` |
| Other 2xx | `send(status, body)` |
| 204 etc. no body | `send(status)` |
| 3xx | `redirect(status, url)` |
| 4xx / 5xx | `throw(status, …)` |

## Create 201

REST “created” often uses **201** with new resource fields in the body. Declare `response({ statusCode: 201, content: ... })` and `ctx.send(201, body)` so types and OpenAPI treat 201 as valid.

```typescript
import { body } from '@aomex/web';

router.post('/users', { // [!code focus:15]
  mount: [
    body({
      name: rule.string().trim().length({ min: 1 }),
    }),
    response({ // [!code highlight]
      statusCode: 201,
      content: { id: rule.int(), name: rule.string() },
    }),
    response({ statusCode: 400 }),
  ],
  action: async (ctx) => {
    const user = await createUser(ctx.body);
    ctx.send(201, { id: user.id, name: user.name });
  },
});
```

## Delete 204

Successful delete with **no JSON** → **204 No Content**. After `response({ statusCode: 204 })`, `ctx.send(204)` is the narrowed correct call—do not send `{}` with 204.

```typescript
import { params } from '@aomex/web';

router.delete('/users/:id', {
  mount: [
    params({ id: rule.int().min(1) }),
    response({ statusCode: 204 }), // [!code highlight]
    response({ statusCode: 404 }),
  ],
  action: async (ctx) => {
    const ok = await deleteUser(ctx.params.id);
    if (!ok) {
      return ctx.throw(404);
    }
    ctx.send(204);
  },
});
```

## Redirect 3xx

Short links, post-login redirect, legacy URL migration—use **3xx** and `ctx.redirect(status, url)`, not hand-set `Location`. Mount `response({ statusCode: 302 })` (or other 3xx) so `redirect` is a typed legal exit.

```typescript
router.get('/go', {
  mount: [
    response({ statusCode: 302 }), // [!code highlight]
  ],
  action: async (ctx) => {
    ctx.redirect(302, 'https://example.com');
  },
});
```

## Paginated list envelope

List APIs often return `{ total, items }` in 200, not a bare array. Pair `response({ statusCode: 200, content: { total, items: rule.array(...) } })` with [query()](/en/web/query) so frontend and OpenAPI share one shape.

```typescript
import { query } from '@aomex/web';

router.get('/users', { // [!code focus:22]
  mount: [
    query({
      page: rule.int().min(1).default(1),
      size: rule.int().min(1).max(50).default(20),
    }),
    response({ // [!code highlight]
      statusCode: 200,
      content: {
        total: rule.int(),
        items: rule.array({
          id: rule.int(),
          name: rule.string(),
        }),
      },
    }),
  ],
  action: async (ctx) => {
    const { page, size } = ctx.query;
    const { total, items } = await listUsers({ page, size });
    ctx.send({ total, items });
  },
});
```

Validation-only 400 without field shape often aligns with global `formatError`:

```typescript
response({ statusCode: 400 }),
```

SSE, plain text, other media types:

```typescript
response({
  statusCode: 200,
  contentType: 'text/event-stream', // [!code highlight]
  content: rule.string(),
}),
```

You can `ctx.send` without `response()`; before launch add success and common 400/404 so OpenAPI and types are not hollow. Declared 200 but `send(201)` in the action type-errors—fix status or `response()` declaration.

## Next steps

- [Error format](/en/web/errors) (4xx/5xx JSON with `response`)
- [Response envelope](/en/web/envelope) (outer HTTP 200 wrapper)
- [Request body](/en/web/body) / [Query string](/en/web/query) (symmetric input side)
- [OpenAPI generation](/en/plugins/openapi)