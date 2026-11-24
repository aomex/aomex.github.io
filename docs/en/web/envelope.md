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

For version, trace fields, etc., use `envelope.slot(schema, get)`: `schema` for OpenAPI; `get(vars, ctx)` gets `{ success, payload, statusCode }` first, then the request context (`WebContext` plus `WebApp.Props`, same surface as `onError`—pathname, headers, services, and so on).

For a constant you can omit both parameters:

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

To read from the current request, use the second argument `ctx`:

```typescript
envelope: {
  content: {
    success: envelope.success,
    statusCode: envelope.statusCode,
    data: envelope.payload,
    path: envelope.slot(rule.string(), (_vars, ctx) => { // [!code highlight]
      return ctx.request.pathname;
    }),
  },
},
```

The return value of `get` must match the inferred type of `schema`; extra keys on a closed object turn red in the type checker.

## formatError and response()

- **[formatError](/en/web/errors)** shapes `ctx.throw` into unified error JSON, then that becomes `envelope.payload`. Configure together; without `formatError`, default plain-text errors still enter payload (as JSON string values).
- **[response()](/en/web/response)** still declares shapes per “real” status; wrapping does not change how you `send` / `throw` in actions—only the outer shell at flush. OpenAPI success/error branches fold into 200 envelope schema (below). For status codes that must **not** be wrapped, register them on the matching `response({ skipEnvelope: true })` (next section).

Keep writing `send(201)`, `throw(404)` in business code—types and route declarations stay on real status codes.

::: tip
When wrapping, if the body is already a JSON string and `Content-Type` is `application/json` (e.g. manual `JSON.stringify` in middleware), the framework `JSON.parse`s first before filling `envelope.payload`, so `data` is not a single escaped text blob.
:::

## When wrapping is skipped

These responses write **unchanged**—no wrapper, no forced 200:

| Case | Reason |
| --- | --- |
| **3xx** redirects | Location semantics cannot become JSON wrapper |
| **204 / 205 / 304** etc. | No body |
| **SSE** (`text/event-stream`) | Streaming frames—not one buffered JSON |
| **Buffer / Stream** bodies | Binary or download streams |

Normal json / string / null (including default 404 without explicit send) are wrapped.

With the [ETag](/en/plugins/etag) plugin: once wrapping rewrites the body, the framework **removes the original ETag** so the digest does not still refer to pre-wrap content.

## Skipping the envelope

When envelope is on site-wide, some exits still need **bare responses** (download pages, legacy clients, HTML doc pages). Two patterns:

**Business routes: prefer `response({ skipEnvelope: true })`**—skips only that mount’s `statusCode`; other status codes on the route still wrap. Runtime and OpenAPI stay aligned.

```typescript
import { rule } from '@aomex/common';
import { response, Router } from '@aomex/web';

export const router = new Router();

router.get('/export.csv', { // [!code focus:14]
  mount: [
    response({
      statusCode: 200,
      contentType: 'text/csv',
      content: rule.string(),
      skipEnvelope: true, // [!code highlight]
    }),
    response({ statusCode: 400 }),
  ],
  action: async (ctx) => {
    ctx.send(await buildCsv());
  },
});
```

Here, successful `200` is bare CSV; validation failure `400` still uses the site wrapper (and `formatError` in payload).

You can mount `response()` multiple times on one route, each with its own `skipEnvelope`—e.g. success wrapped, errors bare, or the opposite.

**Infrastructure responses** (Swagger / Redoc pages, bare OpenAPI JSON) can set `ctx.response.skipEnvelope = true` in the action: unconditional skip for that write, regardless of final status. For business APIs, prefer `response({ skipEnvelope })` above so the contract documents the status.

```typescript
action: async (ctx) => {
  ctx.response.skipEnvelope = true; // [!code highlight]
  ctx.send(rawOpenapiDocument);
},
```

## OpenAPI

Pass the **same `WebApp` (`app`) with `envelope` configured** to `generateOpenapi` / Console `openapi()`: after other `response` / `formatError` injection, 2xx and 4xx·5xx·default fold to **HTTP 200** envelope schema (often `oneOf` with `success` true/false); **keep** 3xx, 204-style no-body codes, and status codes registered with `response({ skipEnvelope: true })`—same skip rules as runtime.

When one operation has both a skipped `200` and wrapped success/error branches, the generator builds `oneOf` on that `200` `application/json` between bare and wrapped schemas; other media (e.g. `text/html`) stay as declared.

`envelope.description` lands on the collapsed `200` response docs. Do not hand-copy a `mount` array or omit `app`—contract stays “201 + bare body” while production is “200 + wrapper”. See [Generate OpenAPI](/en/openapi/).

## Next steps

- [Error format](/en/web/errors): `formatError` and envelope `payload`
- [Response constraints](/en/web/response): declare real status and inner `content`
- [Generate OpenAPI](/en/openapi/): how contracts scan routes
- [Web app entry](/en/web/): other required `WebApp` options