---
outline: deep
---

# Redoc UI

A **long-form readable** API reference for product and partner teams: left nav, folded schemas—calmer than Swagger. Redoc **cannot try requests in the page**—use [Swagger UI](/en/openapi/swagger-ui), [Scalar UI](/en/openapi/scalar-ui), or your own client. Multiple UIs can coexist; keep **URI prefixes distinct**.

Contract sources: [Generate OpenAPI](/en/openapi/).

```bash
pnpm add @aomex/redoc-ui
```

Mount `redocUI`; the team opens `/redoc` (default) to read the same OpenAPI (JSON or YAML path).

## Coexist with Swagger (split prefixes)

```typescript
import { redocUI } from '@aomex/redoc-ui';
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

mount: [ // [!code focus:13]
  redocUI({
    openapi: './openapi.yaml', // [!code highlight]
    // or a function, same as Swagger:
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
Redoc **cannot exercise APIs in the browser**; do not let QA treat it as a Swagger replacement. When coexisting with other docs UIs, split `uriPrefix` and prefer a **random suffix** (e.g. `/redoc-7c3e9a1f02b48d6e`) so scanners miss the page—see [Swagger UI](/en/openapi/swagger-ui).
:::

Like Swagger UI: `redocUI` is Web middleware config—it does not change business-route `ctx` types. `openapi` is a file path or async function returning a `Document`; the function form matches [Generate OpenAPI](/en/openapi/) options.

Access control, `uriPrefix` (including random suffixes), `enable`, and similar options follow the **same ideas as Swagger / Scalar**—exact fields come from the installed package’s type hints.

```typescript
redocUI({
  openapi: './openapi.json',
  uriPrefix: '/redoc-7c3e9a1f02b48d6e',
});
```

How this compares with Swagger / Scalar, coexistence, and scenarios: [Choosing a docs UI](/en/openapi/choose-ui). Wrong static `openapi.yaml` paths or missing build copies → 404 online; after route changes with file contracts, rerun [Generate OpenAPI](/en/openapi/).

## Related

- [Choosing a docs UI](/en/openapi/choose-ui)
- [Swagger UI](/en/openapi/swagger-ui) · [Scalar UI](/en/openapi/scalar-ui)
- [Generate OpenAPI](/en/openapi/)
