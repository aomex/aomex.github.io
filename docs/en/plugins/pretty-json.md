---
outline: deep
---

# Pretty JSON

In development, view **indented JSON** in the browser instead of hunting fields in one long line. Off by default in production—otherwise response size grows a lot (especially costly on mobile), and public APIs shouldn’t grow the body via a query flag.

```bash
pnpm add @aomex/pretty-json
```

## Mount site-wide in development

`prettyJson()` rewrites JSON responses to indented text **after** `await next()`; mount it on `WebApp.mount`. Turn it on locally by environment; use `enable: false` in production.

```typescript
import { prettyJson } from '@aomex/pretty-json';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:7]
    prettyJson({
      enable: process.env.NODE_ENV !== 'production', // [!code highlight]
      query: 'pretty',
    }),
    routers('./src/routers'),
  ],
});
```

Ordinary WebMiddleware; no extra fields on ctx. When Content-Type is still JSON, the body becomes readable text from `JSON.stringify(..., null, spaces)`; object-mode readable streams use streaming stringify. Add `spaces: 4` if the team prefers 4 spaces (default `2`).

## Production on demand: only ?pretty

When site-wide pretty can’t go to production, turn `enable` off and leave only the query switch: visit `/internal/debug/state?pretty` to indent. Don’t rely on this to inflate public routes.

```typescript
prettyJson({
  enable: false,
  query: 'pretty', // [!code highlight]
});
```

| Environment | Recommendation |
| --- | --- |
| Local | `enable: true`, or only `?pretty` |
| Production | `enable: false`; don’t let public routes grow responses via query |

Pretty-printing large lists can make the body several times the compact JSON size and slow Postman too. Stacking with [Compress](/en/plugins/compress) saves a bit, but the root cause is still that pretty lengthened the body.

## Next steps

- JSON response shape: [Constrain response](/en/web/response)
- Shrink size: [Compress](/en/plugins/compress)
- Dev docs UI: [Swagger UI](/en/openapi/swagger-ui)
