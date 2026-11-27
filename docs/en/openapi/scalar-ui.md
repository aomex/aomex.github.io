---
outline: deep
---

# Scalar UI

Serve an API docs page powered by [Scalar](https://github.com/scalar/scalar): modern reading plus in-page try-out. Same contract sources as the other UIs—exported `openapi.json` / yaml or runtime `generateOpenapi`. Can sit beside [Swagger UI](/en/openapi/swagger-ui) / [Redoc UI](/en/openapi/redoc-ui); keep **uriPrefix** distinct (default `/scalar`).

Try the [official demo](https://galaxy.scalar.com/) first. Where the contract comes from: [Generate OpenAPI](/en/openapi/).

```bash
pnpm add @aomex/scalar-ui
```

Mount `scalarUI` on `WebApp.mount`, then open `/scalar` (or your prefix).

## Exported file or dynamic generateOpenapi

**CI already exported** (common):

```typescript
import { scalarUI } from '@aomex/scalar-ui';

mount: [
  scalarUI({ openapi: './openapi.json' }), // [!code highlight]
  routers('./src/routers'),
],
```

YAML / yml paths work too. Browser: `/scalar`; `openapi.json` is usually served under the same prefix for the page to fetch.

**Stay in sync with live routes**:

```typescript
import { scalarUI } from '@aomex/scalar-ui';
import { generateOpenapi } from '@aomex/openapi-generator';
import { app } from '@/app';

mount: [ // [!code focus:12]
  scalarUI({
    uriPrefix: '/api-docs',
    openapi: () => { // [!code highlight]
      return generateOpenapi({
        routers: './src/routers',
        app,
        docs: { openapi: '3.2.1' },
      });
    },
  }),
  routers('./src/routers'),
],
```

`scalarUI` is ordinary Web middleware. `openapi` is a path string or a function returning a Document (async allowed); when using a function, pass the **same** `WebApp` (`app`) into `generateOpenapi` so security / envelope match production. With a site-wide [envelope](/en/web/envelope), the docs page `skipEnvelope`s automatically and is not wrapped.

## uriPrefix, enable, headTags

| Option / pattern | When to use |
| --- | --- |
| `openapi: './openapi.json'` / `.yaml` | After CI `aomex openapi` export |
| `openapi: () => generateOpenapi(...)` | Skip committing the file; same `app` |
| `uriPrefix` | Default `/scalar`; prefer a path with a **random suffix** so scanners miss the docs |
| `enable` | Turn docs off on the public internet, or gate with token / IP allowlist |
| `headTags` | Extra `<head>` tags (favicon, meta, link) |

Defaults like `/scalar` and `/swagger` are easy to guess. A random segment (e.g. `/scalar-7c3e9a1f02b48d6e`) only raises the cost of discovery—it is **not** auth. Same idea as [Swagger UI](/en/openapi/swagger-ui).

```typescript
scalarUI({
  openapi: './openapi.json',
  uriPrefix: '/scalar-7c3e9a1f02b48d6e', // [!code highlight]
  enable: (ctx) => { // [!code highlight]
    const ipOk = ctx!.request.ip === '127.0.0.1';
    const tokenOk =
      ctx!.request.headers['x-docs-token'] === process.env.DOCS_TOKEN;
    return ipOk || tokenOk;
  },
});
```

Site icon:

```typescript
scalarUI({
  openapi: './openapi.json',
  headTags: [
    {
      tag: 'link',
      props: {
        rel: 'shortcut icon',
        type: 'image/x-icon',
        href: '/favicon.ico',
      },
    },
  ],
});
```

Mount without clashing with business API prefixes; with `swaggerUI` / `redocUI`, keep all three `uriPrefix` values distinct (random suffixes recommended).

::: warning
Public docs UI exposes the API map (and try-out). Combine a random prefix with `enable` / network isolation.
:::

Dynamic `openapi` without the live `app` drifts auth / envelope shape from real calls. In static-file mode, rerun [Generate OpenAPI](/en/openapi/) after route changes.

How this compares with Swagger / Redoc, coexistence, and scenarios: [Choosing a docs UI](/en/openapi/choose-ui).

## Related

- [Choosing a docs UI](/en/openapi/choose-ui)
- [Swagger UI](/en/openapi/swagger-ui) · [Redoc UI](/en/openapi/redoc-ui)
- [Generate OpenAPI](/en/openapi/)
