---
outline: deep
---

# OpenAPI document generation

**Declare contracts on routes**, then **scan routes and export OpenAPI 3.0** for partners or CI. Swagger / Redoc are only how you read that JSON—the pipeline lives in `@aomex/openapi`. Use `generateOpenapi` in the Web process; to write a file see [Console export](/en/console/openapi).

Routes without `query` / `body` / `response` leave empty sections in the doc—runtime still works, contract is incomplete. Type narrowing for `send` / `throw`: [Constrain responses](/en/web/response).

```bash
pnpm add @aomex/openapi
```

Hang validators and `response()` on list/detail routes, call `generateOpenapi`, and get a committable `openapi.json` (or an in-memory `Document`). **Pass the same `WebApp` instance as production** (`app`); the generator reads global `mount` and `envelope` so security, error bodies, and wrapping stay aligned with the real environment.

## response and docs on routes

Contracts come from route declarations: `query` / `body` / `params` define input schemas, `response()` documents each status, `docs` sets summary and tags. Runtime validation and type narrowing share the same source; omitted pieces stay empty in `openapi.json`.

```typescript
// src/routers/user.ts
import { rule } from '@aomex/common';
import { query, response, Router } from '@aomex/web';

export const router = new Router({
  prefix: '/users',
  docs: { tags: ['User'] },
});

router.get('/', {
  docs: { summary: 'List users' },
  mount: [query({ page: rule.int().min(1).default(1) })],
  action: async (ctx) => {
    ctx.send([]);
  },
});

router.get('/:id', { // [!code focus:14]
  docs: { summary: 'User detail' },
  mount: [
    response({ // [!code highlight]
      statusCode: 200,
      description: 'User found',
      content: { id: rule.int(), name: rule.string() },
    }),
    response({ statusCode: 404, description: 'Not found' }),
  ],
  action: async (ctx) => {
    // …
  },
});
```

## Pass app to build the Document

`generateOpenapi` expects a **`WebApp` instance**—do not pass a separate `mount` array. It reads global middleware and [response envelope](/en/web/envelope) from `app` as the single source for OpenAPI injection.

When CLI, tests, or scripts `import` this module, **split** `new WebApp(...)` from `app.listen(...)` (or only listen in the real process entry); otherwise import side-effects start the server and grab the port.

```typescript
// src/app.ts — create and export only, no listen
import { formatError, routers, WebApp } from '@aomex/web';
import { rule } from '@aomex/common';
import { services } from './services/index.js';

export const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:12]
    formatError({
      content: { code: rule.string(), message: rule.string() },
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

```typescript
// src/main.ts — process entry listens on port
import { app } from './app.js';

app.listen(3000);
```

```typescript
import { writeFile } from 'node:fs/promises';
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

const document = await generateOpenapi({ // [!code focus:11]
  routers: './src/routers',
  app, // [!code highlight]
  docs: {
    info: { title: 'My API', version: '1.0.0' },
  },
  fix: (doc) => {
    doc.servers = [{ url: 'https://api.example.com' }];
    return;
  },
});

await writeFile('openapi.json', JSON.stringify(document, null, 2));
```

- After `body` / `query` / `params` on a route, `ctx.body`, `ctx.query`, etc. in the action are narrowed—same as the doc schema.
- With `response({ statusCode, content })`, the second arg to `ctx.send(200, …)` must match `content`; declaring 200 but calling `send(201)` usually fails types.
- Hand-written `openapi.onMethod` for one response **usually only affects generated JSON**, not `ctx.send` narrowing—you own types in that case.

Common `response()` fields:

| Field | When to use |
| --- | --- |
| `statusCode` | One mount per exit (200 / 201 / 204 / 404…) |
| `content` | JSON success body; also narrows `ctx.send` |
| `contentType` | Non-default JSON: CSV, HTML, binary |
| `headers` | Document `X-Request-Id`, etc. |
| `example` | Docs site samples; no runtime effect |

Non-JSON example:

```typescript
response({
  statusCode: 200,
  contentType: 'text/csv', // [!code highlight]
  content: rule.string(),
  description: 'CSV export',
});
```

When validators do not fit (binary streams, etc.), mount middleware with `openapi.onMethod` on that route to adjust generation only:

```typescript
import { middleware } from '@aomex/common';

export const openapiBinaryFile = middleware.web({ // [!code focus:18]
  fn: async (_ctx, next) => {
    return next();
  },
  openapi: {
    onMethod(methodItem) { // [!code highlight]
      methodItem.responses ||= {};
      methodItem.responses['200'] = {
        description: 'File stream',
        content: {
          'application/octet-stream': {
            schema: { type: 'string', format: 'binary' },
          },
        },
      };
    },
  },
});
```

## generateOpenapi and runtime exits

`generateOpenapi` scans the router directory and pulls global `mount` / `envelope` from `app` into an OpenAPI Document in memory—write a file, plug into Swagger/ReDoc, or diff in CI. It **does not start HTTP** and does not narrow runtime `ctx`—narrowing still comes from route `mount`.

| `generateOpenapi` option | When to use |
| --- | --- |
| `routers` | Required; same glob as Web route scan |
| `app` | Same `WebApp` as production (carries `mount`, `envelope`) |
| `docs` | `info.title` / `version` / `description` |
| `fix` | Add `servers`, contacts, vendor extensions; prefer route-level `response()` for single responses |

Serve the spec at runtime (custom `/openapi.json`):

```typescript
import { app } from '../app.js';

router.get('/openapi.json', {
  docs: { showInOpenapi: false },
  action: async (ctx) => {
    const document = await generateOpenapi({ // [!code highlight]
      routers: './src/routers',
      app,
    });
    ctx.send(document);
  },
});
```

Scanning every request is costly under traffic—cache, or use CI export + static file.

::: warning
`app` on `generateOpenapi` is **required** (types enforce it) and should match production **configuration** (same instance is simplest). Omitting it fails compile; a different `mount` / `envelope` leaves auth, `formatError`, and wrapping out of sync with the live app.
:::

::: tip
Console export and scripts `import` your Web module: split `new WebApp` from `app.listen` so the CLI does not start HTTP on run.
:::

Fixed export in CI / locally: Console `openapi()` + `aomex openapi`—see [OpenAPI export](/en/console/openapi).

Browse the contract in the browser: [Swagger UI](/en/plugins/swagger-ui) · [Redoc UI](/en/plugins/redoc-ui).

Maintain responses with `response()` on routes when you can, not only `fix` per path. Missing `docs.summary` / `tags` still generates, but partners suffer. The route that serves JSON usually sets `docs.showInOpenapi: false` to avoid describing itself recursively.

## Related

- [Constrain responses](/en/web/response)
- [Response envelope](/en/web/envelope) (with `app`, success/error folded into 200)
- [Error format](/en/web/errors)
- [OpenAPI export](/en/console/openapi)
- [Swagger UI](/en/plugins/swagger-ui) · [Redoc UI](/en/plugins/redoc-ui)