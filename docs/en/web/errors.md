---
outline: deep
---

# Error format

Turn site-wide (or per-module) `ctx.throw` into a unified JSON envelope instead of default plain text: mount `formatError`, use `handler` for the final body, `content` for types and OpenAPI. Change shape here—not by mutating body in `app.on('error')` (too late, fights an already-written response).

```typescript
import { rule } from '@aomex/common';
import { formatError, routers, WebApp } from '@aomex/web';

new WebApp({
  // services / logger / language / proxyIP — see [App entry](/en/web/)
  mount: [
    formatError({ // [!code focus:13]
      content: { // [!code highlight]
        code: rule.string(),
        message: rule.string(),
      },
      handler(err) {
        return {
          code: err.code ?? 'ERROR',
          message: err.message,
        };
      },
    }),
    routers('./src/routers'),
  ],
});
```

Mount `formatError` **outside and before** `routers` so throws from any route hit this handler unless caught deeper.

Handler return shape must match `content`; `ctx.throw(403, { code: 'FORBIDDEN' })` puts business code on `err.code`, message on sanitized `err.message`. Without `statusCodes`, this layer handles **all** 4xx / 5xx. On routes, `response({ statusCode: 400 })` without `content` often borrows the outer `formatError` shape in generated docs. Without `formatError`, clients get framework default plain-text errors.

The handler typically clears existing response headers, sets status from the error code, and `send`s the new body. Do not put `err.raw`, stacks, or SQL in the handler return—only sanitized fields outward.

## Inner envelope per module

Global `formatError` sets the default; **/admin** or public API subsets with different field names (`error` / `detail` vs `code` / `message`) mount another layer on `Router({ mount: [formatError(...)] })`. Inner onion catches first—routes under that prefix use the inner envelope, others use the outer.

```typescript
import { formatError, Router } from '@aomex/web';

const adminRouter = new Router({ // [!code focus:18]
  prefix: '/admin',
  mount: [
    formatError({ // [!code highlight]
      content: {
        error: rule.string(),
        detail: rule.string().optional(),
      },
      handler(err) {
        return {
          error: err.code ?? 'ADMIN_ERROR',
          detail: err.message,
        };
      },
    }),
    auth.authenticate('bearer'),
  ],
});
```

**Inner catches first**: `/admin/*` uses inner shape; other routes keep the global fallback.

## Partial takeover with statusCodes

`statusCodes` limits **this** `formatError` to listed HTTP statuses (often only 400, 422 validation). Other 4xx / 5xx bubble to the outer handler—good for “validation JSON here, business 403 still global envelope”.

```typescript
formatError({ // [!code highlight]
  statusCodes: [400, 422],
  content: {
    code: rule.string(),
    message: rule.string(),
  },
  handler(err) {
    return {
      code: err.code ?? 'VALIDATION',
      message: err.message,
    };
  },
}),
```

## Working with route throws

Use `ctx.throw(status, …)` to end the request and enter the error chain: missing resource **404**, business validation **400**, forbidden **403**, etc. Second arg may be string or object with `code`; `formatError` handler reads codes and messages into `content`.

```typescript
ctx.throw(404);
ctx.throw(400, 'name required');
ctx.throw(403, { code: 'FORBIDDEN' });
```

If headers or body were written before throwing, let `formatError` replace the whole response—do not half-build error JSON in the action.

To wrap success and errors in `{ success, data, statusCode }` with outer HTTP 200, see [Response envelope](/en/web/envelope) (often paired with `formatError`).

## Next steps

- [Response envelope](/en/web/envelope) (unified wrapper and HTTP 200)
- [Response constraints](/en/web/response) (per-route 400/404 declarations)
- [App entry](/en/web/) (global services / logger / language)
- [WebApp.language](/en/web/#language) (validation and error message locale)