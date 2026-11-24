---
outline: deep
---

# CORS

Let browser frontends call your API legally: in development, different ports need to pass preflight; in production, tighten which origins are allowed, and add credentials when cookies are required.

```bash
pnpm add @aomex/cors
```

## Mount before routers

`cors()` writes Access-Control-* response headers in the middleware phase so the browser can read cross-origin response bodies. It must sit **before** `routers`, so every response (including 4xx/5xx) carries the headers—otherwise preflight passes, but when the business returns an error the frontend can’t read the error body.

```typescript
import { cors } from '@aomex/cors';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    cors(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

::: warning
If CORS is mounted **after** routers, 404 and validation 400 responses may lack the headers, and the browser’s “CORS” error can hide the real cause.
:::

When local frontend and backend use different ports and **don’t send cookies**, no-arg `cors()` reflects the Origin request header and is usually enough. Once you need cookies across origins ([Session](/en/plugins/auth-session-strategy)), you must set origin explicitly—see the next section.

cors() returns a normal WebMiddleware and doesn’t attach new fields on ctx; write business actions as usual—cross-origin is solved by response headers. On success in the browser you’ll see Access-Control-Allow-Origin; with cookies you also need Access-Control-Allow-Credentials: true, and you **must not** use origin: '*'.

## Cookie login: explicit origin required

When `credentials: true` (or a function returns `true`):

- You **must** configure `origin` explicitly (a concrete domain, an allowlist array, or a function that returns a concrete origin)
- You **must not** rely on no-arg cors()’s default reflection—missing config throws at create time or on the request
- You **must not** use `origin: '*'` (browsers reject that combination anyway)

If the frontend also sends `Authorization` or `x-csrf-token`, allow them with `allowHeaders`; to let frontend scripts read custom headers like `X-Request-Id`, use `exposeHeaders`.

```typescript
cors({
  origin: 'https://app.example.com', // [!code highlight]
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
  exposeHeaders: ['X-Request-Id'],
});
```

::: warning
Turning on credentials without writing origin, or setting it to `*`, prevents the app from starting or throws on the first request—this intentionally blocks the dangerous default of “reflect any Origin + Cookie”.
:::

Session also needs [CSRF](/en/plugins/csrf), and the frontend `fetch` must use `credentials: 'include'`. Full chain: [Session strategy](/en/plugins/auth-session-strategy).

## Allowlist for multiple frontends

When the app and admin console use different domains, `origin` can be an array; only hits are echoed back—misses mean CORS is not enabled for that request.

```typescript
const allowlist = [
  'https://app.example.com',
  'https://admin.example.com',
];

cors({
  origin: allowlist, // [!code highlight]
  credentials: true,
  allowHeaders: ['Content-Type', 'x-csrf-token'],
});
```

You can also use a function that returns a concrete origin per request (echo only on allowlist hit; return `undefined` on miss to disable CORS):

```typescript
cors({
  origin: (ctx) => {
    const origin = ctx.request.headers['origin'];
    if (typeof origin === 'string' && allowlist.includes(origin)) {
      return origin;
    }
    return undefined;
  },
  credentials: true,
});
```

Preflight cache defaults to about one hour (`maxAge: 3600`); for local debugging set `-1` so every OPTIONS is hit again. Tighten with `allowMethods` when you only want GET/POST. `secureContext` / `privateNetworkAccess` are only needed when isolated pages / public sites call an intranet API (Chrome PNA).

| Environment | Recommendation |
| --- | --- |
| Local (no cookies) | No-arg `cors()` |
| Local (Session) | `origin: 'http://localhost:5173'` + `credentials: true` |
| Production | Explicit domains or allowlist; never use default reflection with credentials |

If you only update the Web API origin and forget the docs site / Swagger / admin origins, preflight fails on those domains.

## Next steps

- Full cookie-login chain: [Session strategy](/en/plugins/auth-session-strategy)
- Protect write requests from forgery: [CSRF](/en/plugins/csrf)
- Mount order and the onion model: [Middleware](/en/core/middleware)
- Security response headers (often next to CORS): [Helmet](/en/plugins/helmet)
- Site-wide observability: [HTTP access log](/en/plugins/access-log)
