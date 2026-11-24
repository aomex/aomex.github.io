---
outline: deep
---

# Swagger UI

Host **click-to-try** API docs on localhost or an internal network. You need an OpenAPI Document (exported `openapi.json` or runtime `generateOpenapi`). For long-form reading see [Redoc UI](/en/openapi/redoc-ui); for a modern try-out UI see [Scalar UI](/en/openapi/scalar-ui). Multiple UIs can coexist—**keep prefixes distinct**.

Try the [official demo](https://petstore.swagger.io/) first. Contract sources: [Generate OpenAPI](/en/openapi/).

```bash
pnpm add @aomex/swagger-ui
```

Mount `swaggerUI` on `WebApp.mount`; teammates open `/swagger` (or your prefix) to browse and Try it out.

## Exported file or dynamic generateOpenapi

**CI already exported** (common):

```typescript
import { swaggerUI } from '@aomex/swagger-ui';

mount: [
  swaggerUI({ openapi: './openapi.json' }), // [!code highlight]
  routers('./src/routers'),
],
```

Browser: `/swagger` (or `/swagger/index.html`); the spec JSON is usually `openapi.json` under the same prefix.

**Stay in sync with live routes** (no static file):

```typescript
import { swaggerUI } from '@aomex/swagger-ui';
import { generateOpenapi } from '@aomex/openapi-generator';
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

`swaggerUI` is ordinary Web middleware in `mount`—it does not change how the compiler infers business routes. `openapi` may be a **path string** or a **function returning `Promise<Document>`**; when using a function, pass the **same** `WebApp` (`app`) into `generateOpenapi`, or security / envelope in the docs will diverge from production.

If `enable` is a function, it receives request context for an internal gate—a boolean return is type-checked.

## uriPrefix and production enable

| Option / pattern | When to use |
| --- | --- |
| `openapi: './openapi.json'` | After CI `aomex openapi` export |
| `openapi: () => generateOpenapi(...)` | Skip committing the contract file; pass the same `app` |
| `uriPrefix` | Override default `/swagger`; prefer a **random suffix** so scanners miss the docs |
| `enable` | Turn docs off on the public internet, or gate with token / IP allowlist |

Defaults like `/swagger`, `/redoc`, `/scalar` are easy to guess. Scaffolding uses prefixes such as `/swagger-7c3e9a1f02b48d6e`—security through obscurity only raises the bar; still pair with `enable` or network isolation.

```typescript
swaggerUI({
  openapi: './openapi.json',
  uriPrefix: '/swagger-7c3e9a1f02b48d6e',
});
```

Gate production access:

```typescript
swaggerUI({
  openapi: './openapi.json',
  uriPrefix: '/swagger-7c3e9a1f02b48d6e',
  enable: (ctx) => { // [!code highlight]
    const ipOk = ctx!.request.ip === '127.0.0.1';
    const tokenOk =
      ctx!.request.headers['x-docs-token'] === process.env.DOCS_TOKEN;
    return ipOk || tokenOk;
  },
});
```

Mount before or after `routers` usually works—**do not clash with business API prefixes**. With `redocUI` / `scalarUI`, keep each `uriPrefix` distinct (random suffixes recommended for all).

::: warning
Public Swagger exposes your API map plus Try it out—combine a random prefix with `enable` / network isolation.
:::

Dynamic `openapi: () => generateOpenapi(...)` without the live `app` shows “no auth” and a missing envelope while calls return 401. In static mode, code changes without refreshing the file leave a stale UI.

How this compares with Redoc / Scalar, coexistence, and scenarios: [Choosing a docs UI](/en/openapi/choose-ui).

## Related

- [Choosing a docs UI](/en/openapi/choose-ui)
- [Scalar UI](/en/openapi/scalar-ui) · [Redoc UI](/en/openapi/redoc-ui)
- [Generate OpenAPI](/en/openapi/)
