---
outline: deep
---

# Generate OpenAPI

**Declare contracts on routes**, then scan them into OpenAPI 3.0: in memory for scripts / Swagger, or **write to disk** via Console for CI and SDKs. The generation pipeline lives in `@aomex/openapi-generator`; Swagger / Redoc are only ways to read that JSON.

Routes without mounted `query` / `body` / `response` leave the corresponding sections empty in the doc—runtime still works, but the contract is incomplete. Type narrowing for `send` / `throw`: [Constrain responses](/en/web/response).

```bash
pnpm add @aomex/openapi-generator
```

**Pass the same `WebApp` instance as production** (`app`). The generator reads its global `mount` and `envelope` so security, error bodies, and wrapping are less likely to drift from the live app.

## response and docs on routes

Contracts come from declarations on routes: `query` / `body` / `params` define input schemas, `response()` documents each status code exit, and `docs` carries summary and tags. Runtime validation and type narrowing share the same source; omitted sections stay empty in `openapi.json`.

For grouping, default filename tags, and overrides, see [Tags](/en/openapi/tags); for Markdown in `info.description` and route-level docs, see [Markdown copy](/en/openapi/markdown).

```typescript
// src/routers/user.ts
import { rule } from '@aomex/common';
import { query, response, Router } from '@aomex/web';

export const router = new Router({
  prefix: '/users',
  docs: { tags: ['User'] },
});

router.get('/', {
  docs: { summary: '用户列表' },
  mount: [query({ page: rule.int().min(1).default(1) })],
  action: async (ctx) => {
    ctx.send([]);
  },
});

router.get('/:id', { // [!code focus:14]
  docs: { summary: '用户详情' },
  mount: [
    response({ // [!code highlight]
      statusCode: 200,
      description: '找到用户',
      content: { id: rule.int(), name: rule.string() },
    }),
    response({ statusCode: 404, description: '不存在' }),
  ],
  action: async (ctx) => {
    // …
  },
});
```

## Pass app to build the Document

`generateOpenapi` expects a **`WebApp` instance**—do not pass a separate `mount` array. It reads global middleware and the [response envelope](/en/web/envelope) from `app` as the single source for OpenAPI injection.

When CLI, tests, or scripts `import` this module, **split** `new WebApp(...)` from `app.listen(...)` (or only call `listen` in the real process entry); otherwise import side effects start the server and grab the port.

```typescript
// src/app.ts —— 只创建并导出，不 listen
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
// src/main.ts —— 进程入口才听端口
import { app } from './app.js';

app.listen(3000);
```

```typescript
import { writeFile } from 'node:fs/promises';
import { generateOpenapi } from '@aomex/openapi-generator';
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

- After `body` / `query` / `params` on a route, `ctx.body`, `ctx.query`, etc. in the action are already narrowed—same as the doc schema.
- With `response({ statusCode, content })`, the second argument to `ctx.send(200, …)` must match `content`; declaring 200 but calling `send(201)` usually fails the type check.
- When you only patch one response with hand-written `openapi.onMethod`, **that generally affects generated JSON only**, not `ctx.send` narrowing—you own types in that case.

Common `response()` fields:

| Field | When to use |
| --- | --- |
| `statusCode` | Mount once per exit (200 / 201 / 204 / 404…) |
| `content` | JSON success body; also narrows `ctx.send` |
| `contentType` | Non-default JSON: CSV, HTML, binary |
| `headers` | Document headers such as `X-Request-Id` |
| `example` | Samples for the docs site; no runtime effect |

Non-JSON example:

```typescript
response({
  statusCode: 200,
  contentType: 'text/csv', // [!code highlight]
  content: rule.string(),
  description: '导出 CSV',
});
```

For the few responses validators cannot express (binary streams, etc.), mount middleware with `openapi.onMethod` on that route to adjust generation only:

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
        description: '文件流',
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

## generateOpenapi options and runtime endpoints

`generateOpenapi` reads the router directory and pulls global `mount` / `envelope` from `app`, assembling an OpenAPI Document in memory—write a file, plug into Swagger / ReDoc, or diff in CI. It **does not start HTTP** and does not narrow runtime `ctx` automatically—narrowing still comes from route `mount`.

| `generateOpenapi` option | When to use |
| --- | --- |
| `routers` | Required; same glob as Web route scan |
| `app` | Same `WebApp` instance as production (carries `mount`, `envelope`) |
| `docs` | `info.title` / `version` / `description` |
| `fix` | Add `servers`, contacts, vendor extensions; prefer route-level `response()` for single responses |

Serve the spec dynamically at runtime (custom `/openapi.json`):

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

Scanning on every request is costly under traffic—add caching, or use Console disk export + a static file below.

::: warning
`app` on `generateOpenapi` is **required** (types enforce it) and should be the **same configuration** as production (the same instance is simplest). Omitting it fails compile; a different `mount` / `envelope` leaves auth, `formatError`, and envelope wrapping out of sync with the live app.
:::

## Console export: `openapi()` + `aomex openapi`

When you only need the contract as a **file** without changing the HTTP process, mount `openapi({ routers, app, saveToFile, … })` on `ConsoleApp` and run `aomex openapi`. Under the hood it uses the same generation logic, as a batch write to disk.

```typescript
// src/cli.ts
import { openapi } from '@aomex/openapi-generator';
import { commanders, ConsoleApp } from '@aomex/console';
import { app } from './app.js';
import { services } from './services/index.js';

new ConsoleApp({
  services,
  logger: services.logger,
  language: 'zh-CN',
  mount: [
    openapi({ // [!code focus:18]
      routers: './src/routers',
      app, // [!code highlight]
      saveToFile: 'openapi.json',
      docs: {
        info: {
          title: 'My API',
          version: '1.0.0',
        },
      },
      fix: (doc) => {
        doc.servers = [{ url: 'https://api.example.com' }];
        return;
      },
    }),
    commanders('./src/commanders'),
  ],
});
```

```bash
npx aomex openapi
# 脚手架里常见：pnpm aomex openapi
```

After success, the contract file appears in the current working directory (or the path you configured). `routers` / `app` / `docs` / `fix` mean the same as on `generateOpenapi`; the extra option is `saveToFile` (default `openapi.json`).

::: tip
Console export and script generation both `import` your Web module: split `new WebApp` from `app.listen` so the CLI does not start HTTP when it runs.
:::

::: warning
Align `saveToFile` with CI artifact directories, or the pipeline will not find the file and downstream SDKs keep an old contract. After route or `app` mount / envelope changes, run `aomex openapi` so the committed contract does not drift.
:::

CI archive example:

```typescript
openapi({
  routers: './src/routers',
  app,
  saveToFile: 'artifacts/openapi.json', // [!code highlight]
  docs: {
    info: { title: 'My API', version: '1.0.0' },
  },
});
```

| Scenario | Approach |
| --- | --- |
| Archive contract on every CI build | `openapi()` + `aomex openapi` |
| Refresh file locally after route changes | Same, run manually |
| Serve latest JSON per request at runtime | Web route calling `generateOpenapi({ routers, app })` |
| Try endpoints during development | Start with [Choosing a docs UI](/en/openapi/choose-ui), then mount [Swagger UI](/en/openapi/swagger-ui) / [Redoc UI](/en/openapi/redoc-ui) / [Scalar UI](/en/openapi/scalar-ui) to read the on-disk file or dynamic `generateOpenapi` output |

Disk export and runtime `/openapi.json` are not the same thing: frequent online scans cost CPU; most production doc sites use disk export + static hosting or UI plugins that read the file.

Prefer maintaining responses with `response()` on routes when you can, not only hand-editing every path in `fix`. Missing `docs.summary` / tags still generates, but partners suffer when browsing the doc—for grouping and copy, see [Tags](/en/openapi/tags) · [Markdown copy](/en/openapi/markdown). The route that serves JSON usually sets `docs.showInOpenapi: false` so it does not describe itself recursively.

## Related

- [Tags](/en/openapi/tags)
- [Markdown copy](/en/openapi/markdown)
- [Constrain responses](/en/web/response)
- [Response envelope](/en/web/envelope) (with `app`, success and error branches fold into 200; statuses with `skipEnvelope` stay as declared)
- [Error format](/en/web/errors)
- [Choosing a docs UI](/en/openapi/choose-ui) · [Swagger UI](/en/openapi/swagger-ui) · [Redoc UI](/en/openapi/redoc-ui) · [Scalar UI](/en/openapi/scalar-ui)