---
outline: deep
---

# Redoc UI

A **long-form readable** API reference for product and partner teams: left nav, folded schemas—calmer than Swagger. Redoc **cannot try requests in the page**—use [Swagger UI](/en/plugins/swagger-ui) or your own client for that. Both UIs can coexist; keep **URI prefixes distinct**.

Contract sources: [OpenAPI generation](/en/plugins/openapi) · [OpenAPI export](/en/console/openapi).

```bash
pnpm add @aomex/redoc-ui
```

Mount `redocUI` in `mount`; the team opens `/redoc` (default) to read the same OpenAPI (JSON or YAML path).

## Separate prefix from Swagger

```typescript
import { redocUI } from '@aomex/redoc-ui';
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

mount: [ // [!code focus:13]
  redocUI({
    openapi: './openapi.yaml', // [!code highlight]
    // or like Swagger, a function:
    // openapi: () => {
    //   return generateOpenapi({
    //     routers: './src/routers',
    //     app,
    //   });
    // },
  }),
  routers('./src/routers'),
],
```

Alongside Swagger:

```typescript
mount: [
  swaggerUI({ openapi: './openapi.json', uriPrefix: '/swagger' }),
  redocUI({ openapi: './openapi.json', uriPrefix: '/redoc' }), // [!code highlight]
  routers('./src/routers'),
],
```

::: warning
Redoc **cannot exercise APIs in the browser**; do not let QA treat it as a Swagger replacement. When both are mounted, split `uriPrefix` (e.g. `/redoc` vs `/swagger`).
:::

Like Swagger UI: `redocUI` is Web middleware config—it does not change business-route `ctx` types. `openapi` is a file path or async function returning a `Document`; the function form matches [OpenAPI generation](/en/plugins/openapi) options.

Access control, `uriPrefix`, `enable`, and similar options follow the **same ideas as Swagger**—exact fields come from the installed package’s type hints.

## When Redoc vs Swagger

| Situation | Guidance |
| --- | --- |
| External PDF / handoff docs | Redoc reads better; exported contract + stable URL |
| Dev self-test, calling APIs | Add Swagger UI or Postman |
| Contract changes often | `openapi: () => generateOpenapi(...)`, or CI export then both read one file |
| Exposed in production | Like Swagger—`enable`, internal network, or gateway auth |

Wrong static `openapi.yaml` path or missing build copy → 404 online. After route changes with file-based contracts, rerun [OpenAPI export](/en/console/openapi).

## Related

- [Swagger UI](/en/plugins/swagger-ui)
- [OpenAPI generation](/en/plugins/openapi)
- [OpenAPI export](/en/console/openapi)