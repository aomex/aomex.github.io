---
outline: deep
---

# Pretty JSON

In development, serve **indented JSON** in the browser instead of one long line. Production should stay off—response size balloons (especially on mobile), and public APIs should not depend on a query knob to inflate bodies.

```bash
pnpm add @aomex/pretty-json
```

## Mount for development

`prettyJson()` runs **after** `await next()` and reformats JSON responses as indented text—add it to `WebApp.mount`. In production use `enable: false` or rely on `?pretty` only.

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

Plain `WebMiddleware`; no extra `ctx` fields. While `Content-Type` stays JSON, the body becomes readable `JSON.stringify(..., null, spaces)` text; object-mode readable streams use streaming stringify.

## `enable` and `query` switches

| Option | When to use | Default |
| --- | --- | --- |
| `enable` | Production must be `false`; internal debug tools may opt in | `true` |
| `query` | No site-wide pretty; only when `?pretty` is present | — |
| `spaces` | Team preference for 2 vs 4 spaces | `2` |

```typescript
prettyJson({ spaces: 4 });
```

### Internal / on demand only

```typescript
prettyJson({
  enable: false,
  query: 'pretty', // [!code highlight]
});
// GET /internal/debug/state?pretty
```

| Environment | Guidance |
| --- | --- |
| Local | `enable: true` or `?pretty` only |
| Production | `enable: false`; do not let public routes grow bodies via query |

Prettying large lists can be several times the compact JSON size—Postman will choke too. With [Compress](/en/plugins/compress) you recover some bytes, but pretty still lengthens the body.

## Next steps

- JSON response shape: [Response constraints](/en/web/response)
- Shrink payloads: [Compress](/en/plugins/compress)
- Dev API UI: [Swagger UI](/en/plugins/swagger-ui)