---
outline: deep
---

# OpenAPI generation

**Declare contracts on routes**, then **scan routes into OpenAPI 3.0** for partners or CI. Swagger / Redoc are readers—the pipeline lives in `@aomex/openapi`. Web uses `generateOpenapi`; file export: [Console export](/en/console/openapi).

Routes without `query` / `body` / `response` leave empty doc sections—runtime still works, contract incomplete. Type narrowing for `send` / `throw`: [Response constraints](/en/web/response).

```bash
pnpm add @aomex/openapi
```

Mount validators and `response()` on list/detail routes, call `generateOpenapi`, get committable `openapi.json` (or in-memory `Document`). **Pass the same `WebApp` (`app`) as production** so global `mount` and `envelope` stay aligned—security, error bodies, wrappers.

## response and docs on routes

Contract comes from route declarations: `query` / `body` / `params` for input schemas, `response()` for status exits, `docs` for summary/tags. Runtime validation and docs share the same source; missing mounts mean empty OpenAPI sections.

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

## Pass app to generate Document

`generateOpenapi` wants a **`WebApp` instance**—do not pass a duplicate `mount` array. It reads global middleware and [Response envelope](/en/web/envelope) as the single source for OpenAPI injection.

When CLI/tests `import` the module, **split** `new WebApp(...)` from `app.listen(...)` or only listen in the real entry—or import side-effects start HTTP and steal the port.

```typescript
// src/app.ts — create and export, no listen
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
// src/main.ts — entry listens
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

- After `body` / `query` / `params`, `ctx.body` / `ctx.query` narrow in actions—same schemas as docs.
- After `response({ statusCode, content })`, `ctx.send(200, …)` must match `content`; declared 200 but `send(201)` usually type-errors.
- Hand-written `openapi.onMethod` for one response **usually affects JSON only**, not `ctx.send` types—you own those.

Common `response()` fields:

| Field | When to use |
| --- | --- |
| `statusCode` | One mount per exit (200 / 201 / 204 / 404…) |
| `content` | JSON success body; narrows `ctx.send` |
| `contentType` | CSV, HTML, binary non-default JSON |
| `headers` | Document `X-Request-Id`, etc. |
| `example` | Doc examples, no runtime effect |

Non-JSON example:

```typescript
response({
  statusCode: 200,
  contentType: 'text/csv', // [!code highlight]
  content: rule.string(),
  description: 'CSV export',
});
```

When validators cannot describe a response (binary stream), mount middleware with `openapi.onMethod` to patch generation only:

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

## generateOpenapi vs runtime

`generateOpenapi` reads the route directory and `app` global `mount` / `envelope`, builds an OpenAPI `Document` in memory—write file, Swagger/ReDoc, CI diff. **Does not start HTTP** or narrow runtime `ctx`—mounts on routes still do.

| `generateOpenapi` option | When to use |
| --- | --- |
| `routers` | Required; same glob as Web |
| `app` | Same `WebApp` as production (mount, envelope) |
| `docs` | `info.title` / `version` / `description` |
| `fix` | Patch `servers`, contacts, extensions; prefer route `response()` per operation |

Runtime spec endpoint:

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

Rescanning every request is costly—cache or use CI export + static file.

::: warning
`app` in `generateOpenapi` must match **production config** (same instance easiest). `routers` without `app` drops global auth, `formatError`, `envelope` from the doc.
:::

::: tip
Console export and scripts `import` Web modules—split `new WebApp` and `app.listen` so CLI does not start HTTP.
:::

CI / local **file export**: Console `openapi()` + `aomex openapi`—[OpenAPI export](/en/console/openapi).

Browse in browser: [Swagger UI](/en/plugins/swagger-ui) · [Redoc UI](/en/plugins/redoc-ui).

Prefer route `response()` over hand-editing every operation in `fix`. Missing `docs.summary` / tags still generates—but partners suffer. The route serving JSON should set `docs.showInOpenapi: false` to avoid self-reference.

## Related

- [Response constraints](/en/web/response)
- [Response envelope](/en/web/envelope) (with `app`, folds success/error to 200)
- [Error format](/en/web/errors)
- [OpenAPI export](/en/console/openapi)
- [Swagger UI](/en/plugins/swagger-ui) · [Redoc UI](/en/plugins/redoc-ui)