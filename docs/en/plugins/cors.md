---
outline: deep
---

# CORS

Let browser frontends call your API legally: dev often splits ports and needs preflight; production tightens which **origins** are allowed; cookies need **credentials** configured.

```bash
pnpm add @aomex/cors
```

## Before routers

`cors()` writes `Access-Control-*` headers so browsers can read cross-origin responses. Mount **before** `routers` so all responses (including 4xx/5xx) carry headers—otherwise preflight passes but error bodies are unreadable.

```typescript
import { cors } from '@aomex/cors';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'en-US' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    cors(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

::: warning
CORS **after** `routers` may drop headers on 404 and validation 400—browser “CORS errors” hide the real cause.
:::

Local split ports **without** Cookies: parameterless `cors()` reflects request `Origin`—usually enough. Once you send Cookies across origins ([Session](/en/plugins/auth-session-strategy)), you must set `origin` explicitly—see below.

`cors()` is plain `WebMiddleware`—no new `ctx` fields; actions unchanged. Success shows `Access-Control-Allow-Origin`; with cookies you also need `Access-Control-Allow-Credentials: true` and **cannot** use `origin: '*'`.

## Tighten origin and credentials

| Option | When to use | Default |
| --- | --- | --- |
| `origin` | Fixed frontend domain in prod, or allowlist / function | Reflect request `Origin` when credentials are off; **required** when credentials are on |
| `credentials` | Cross-origin cookies / client certificates | `false` |
| `allowHeaders` | Custom headers like `Authorization`, `x-csrf-token` | — |
| `exposeHeaders` | Let JS read `X-Request-Id` etc. | — |
| `maxAge` | Fewer OPTIONS; `-1` disables cache while debugging | `3600` |
| `allowMethods` | Restrict to GET/POST only | common verb set |
| `secureContext` / `privateNetworkAccess` | Isolated pages, public site calling private API (Chrome PNA) | `false` |

### Cookie login: explicit origin required

With `credentials: true` (or a function that returns `true`):

- You **must** set `origin` explicitly (concrete domain, allowlist array, or a function that returns a concrete origin)
- You **must not** rely on bare `cors()` reflection—missing `origin` throws at create time or on the request
- You **must not** use `origin: '*'` (browsers reject that combination too)

```typescript
cors({
  origin: 'https://app.example.com', // [!code highlight]
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
  exposeHeaders: ['X-Request-Id'],
});
```

::: warning
Credentials without an explicit `origin`, or with `*`, fail fast on purpose—so “reflect any Origin + Cookie” cannot be the accidental default.
:::

Session also needs [CSRF](/en/plugins/csrf), and the front end must call `fetch` with `credentials: 'include'`. Full flow: [Session strategy](/en/plugins/auth-session-strategy).

### Multiple frontend origins

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

Or return a concrete origin from a function (only when allowlisted; otherwise `undefined` disables CORS for that request):

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

| Environment | Guidance |
| --- | --- |
| Local (no Cookie) | Parameterless `cors()` |
| Local (Session) | `origin: 'http://localhost:5173'` + `credentials: true` |
| Production | Explicit domain or allowlist; never default-reflect when credentials are on |

Forgetting doc sites / Swagger / admin origins breaks preflight on those domains.

## Next steps

- Cookie login end-to-end: [Session strategy](/en/plugins/auth-session-strategy)
- Protect writes: [CSRF](/en/plugins/csrf)
- Mount order and onion model: [Middleware](/en/core/middleware)
- Security headers (often beside CORS): [Helmet](/en/plugins/helmet)
- Site-wide observability: [HTTP access log](/en/plugins/http-access-log)
