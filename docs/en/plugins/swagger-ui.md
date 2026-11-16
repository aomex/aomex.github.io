---
outline: deep
---

# Swagger UI

Host **click-to-try** API docs on localhost or internal networks. Requires an OpenAPI Document (exported `openapi.json` or runtime `generateOpenapi`). Long-form reading: [Redoc UI](/en/plugins/redoc-ui); both can coexist—**keep prefixes distinct**.

Contract sources: [OpenAPI generation](/en/plugins/openapi) · [OpenAPI export](/en/console/openapi).

```bash
pnpm add @aomex/swagger-ui
```

Mount `swaggerUI` on `WebApp.mount`; developers open `/swagger` (or your prefix) to browse and Try it out.

## Static file or dynamic generateOpenapi

**CI export** (common):

```typescript
import { swaggerUI } from '@aomex/swagger-ui';

mount: [
  swaggerUI({ openapi: './openapi.json' }), // [!code highlight]
  routers('./src/routers'),
],
```

Browser: `/swagger` (or `/swagger/index.html`); spec JSON usually under the same prefix as `openapi.json`.

**In sync with live routes** (no static file):

```typescript
import { swaggerUI } from '@aomex/swagger-ui';
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

mount: [ // [!code focus:12]
  swaggerUI({
    uriPrefix: '/docs',
    openapi: () => { // [!code highlight]
      return generateOpenapi({
        routers: './src/routers',
        app,
      });
    },
  }),
  routers('./src/routers'),
],
```

`swaggerUI` is plain Web middleware—does not change business route inference. `openapi` is a **path string** or **function returning `Promise<Document>`**; with a function pass the **same** `WebApp` (`app`) to `generateOpenapi` or security / envelope in docs diverge from production.

`enable` as a function receives request context for internal gates—boolean return is type-checked.

## uriPrefix and production enable

| Option / pattern | When to use |
| --- | --- |
| `openapi: './openapi.json'` | After CI `aomex openapi` export |
| `openapi: () => generateOpenapi(...)` | Skip committing contract file; pass same `app` |
| `uriPrefix` | Avoid default `/swagger` collision |
| `enable` | Disable on public internet or add token / IP allowlist |

Production restriction example:

```typescript
swaggerUI({
  openapi: './openapi.json',
  enable: (ctx) => { // [!code highlight]
    const ipOk = ctx!.request.ip === '127.0.0.1';
    const tokenOk =
      ctx!.request.headers['x-docs-token'] === process.env.DOCS_TOKEN;
    return ipOk || tokenOk;
  },
});
```

Mount before or after `routers` usually works—**do not clash with business API prefixes** (e.g. business `/docs` vs `uriPrefix: '/docs'`). With `redocUI`, split prefixes.

::: warning
Public Swagger exposes your API map plus Try it out—at minimum use `enable` or network isolation.
:::

Dynamic `openapi: () => generateOpenapi(...)` without the live `app` shows “no auth” and missing envelope while calls 401. Static mode: code changes without refreshing the file leave stale UI.

## Related

- [Redoc UI](/en/plugins/redoc-ui)
- [OpenAPI generation](/en/plugins/openapi)
- [OpenAPI export](/en/console/openapi)