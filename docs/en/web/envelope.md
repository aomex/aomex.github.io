---
outline: deep
---

# Response envelope

Many teams want **success and failure in one JSON wrapper** (e.g. `{ success, data, statusCode }`) with outer HTTP fixed at **200** and the real business code inside the body. `WebApp.envelope` wraps body and status before flush based on your declared tree.

Routes still use `ctx.send(201, …)` / `ctx.throw(400, …)`; wrapping happens at flush—not hand-built shells in every action.

```typescript
import { rule } from '@aomex/common';
import { envelope, formatError, routers, WebApp } from '@aomex/web';

new WebApp({
  // services / logger / language / proxyIP — see [App entry](/en/web/)
  envelope: { // [!code focus:7]
    content: {
      success: envelope.success, // [!code highlight]
      statusCode: envelope.statusCode,
      data: envelope.payload,
    },
  },
  mount: [
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

Then:

- `ctx.send(201, { id: 1 })` → HTTP **200**, body like `{ success: true, statusCode: 201, data: { id: 1 } }`
- `ctx.throw(400, …)` (with `formatError`) → HTTP **200**, `success: false`, `data` holds error JSON; real **400** in `statusCode` slot

Clients must read success in the body—**not HTTP status alone** (redirects and empty responses excepted below).

## Built-in slots

`content` is a declaration tree—leaves are built-in slots or `envelope.slot`, or nested plain objects. Do not drop raw `rule.string()`—no runtime source.

| Slot | Runtime meaning |
| --- | --- |
| `envelope.success` | Whether original status `< 400` |
| `envelope.payload` | Body before wrapping (json / string / null) |
| `envelope.statusCode` | HTTP status before wrap (outer write stays 200) |

Name the field `data`, `result`, or `payload`—hang built-in slots on your keys.

## Custom slots and nesting

For version, trace fields, etc., use `envelope.slot(schema, get)`: `schema` for OpenAPI, `get` reads only `{ success, payload, statusCode }`.

```typescript
envelope: {
  content: {
    meta: {
      ok: envelope.success,
      code: envelope.statusCode,
      version: envelope.slot(rule.string(), () => '1.0'), // [!code highlight]
    },
    result: envelope.payload,
  },
},
```

In `get`, do not touch `ctx`, `services`, etc.—only the three values above exist at wrap time.

## formatError and response()

- **[formatError](/en/web/errors)** shapes `ctx.throw` into unified error JSON, then that becomes `envelope.payload`. Configure together; without `formatError`, default plain-text errors still enter payload (as JSON string values).
- **[response()](/en/web/response)** still declares shapes per “real” status; wrapping does not change how you `send` / `throw` in actions—only the outer shell at flush. OpenAPI success/error branches fold into 200 envelope schema (below).

Keep writing `send(201)`, `throw(404)` in business code—types and route declarations stay on real status codes.

## When wrapping is skipped

These responses write **unchanged**—no wrapper, no forced 200:

| Case | Reason |
| --- | --- |
| **3xx** redirects | Location semantics cannot become JSON wrapper |
| **204 / 205 / 304** etc. | No body |
| **SSE** (`text/event-stream`) | Streaming frames—not one buffered JSON |
| **Buffer / Stream** bodies | Binary or download streams |

Normal json / string / null (including default 404 without explicit send) are wrapped.

## OpenAPI

Pass the **same `WebApp` (`app`) with `envelope` configured** to `generateOpenapi` / Console `openapi()`: after other `response` / `formatError` injection, 2xx and 4xx·5xx·default fold to **HTTP 200** envelope schema (often `oneOf` with `success` true/false); **3xx** and 204-style codes stay per runtime skip rules.

`envelope.description` lands on the collapsed `200` response docs. Do not hand-copy a `mount` array or omit `app`—contract stays “201 + bare body” while production is “200 + wrapper”. See [OpenAPI generation](/en/plugins/openapi).

## Next steps

- [Error format](/en/web/errors): `formatError` and envelope `payload`
- [Response constraints](/en/web/response): declare real status and inner `content`
- [OpenAPI generation](/en/plugins/openapi): how contracts scan routes
- [Web app entry](/en/web/): other required `WebApp` options