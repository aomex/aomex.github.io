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
  language: { mode: 'fixed', language: 'zh-CN' },
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

Local split ports: parameterless `cors()` often reflects request `Origin`—enough for dev. In production use explicit domains.

`cors()` is plain `WebMiddleware`—no new `ctx` fields; actions unchanged. Success shows `Access-Control-Allow-Origin`; with cookies you also need `Access-Control-Allow-Credentials: true` and **cannot** use `origin: '*'`.

## Tighten origin and credentials

| Option | When to use | Default |
| --- | --- | --- |
| `origin` | Fixed frontend domain in prod, or function whitelist for multiple frontends | Reflect request `Origin` |
| `credentials` | Cross-origin cookies / auth headers | — |
| `allowHeaders` | Custom headers like `Authorization` | — |
| `exposeHeaders` | Let JS read `X-Request-Id` etc. | — |
| `maxAge` | Fewer OPTIONS; `-1` disables cache while debugging | `3600` |
| `allowMethods` | Restrict to GET/POST only | common verb set |
| `secureContext` / `privateNetworkAccess` | Isolated pages, public site calling private API (Chrome PNA) | `false` |

### Production: cookies + single frontend

```typescript
cors({
  origin: 'https://app.example.com', // [!code highlight]
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-Request-Id'],
});
```

::: warning
With `credentials: true` you **cannot** use `origin: '*'—browsers reject it.
:::

### Production: multiple frontend origins

```typescript
const allowlist = new Set([
  'https://app.example.com',
  'https://admin.example.com',
]);

cors({
  origin: (ctx) => { // [!code highlight]
    const origin = ctx.request.headers['origin'];
    if (origin && allowlist.has(origin)) {
      return origin;
    }
    return false;
  },
  credentials: true,
});
```

| Environment | Guidance |
| --- | --- |
| Local | Parameterless `cors()` or allowlist `http://localhost:5173` |
| Production | Do not reflect arbitrary `Origin`; with `credentials`, origin must be explicit |

Default reflect in production exposes the API to any site—worse with cookies. Forgetting doc sites / Swagger / admin origins breaks preflight on those domains.

## Next steps

- Mount order and onion model: [Middleware](/en/core/middleware)
- Security headers (often beside CORS): [Helmet](/en/plugins/helmet)
- Site-wide observability: [HTTP access log](/en/plugins/http-access-log)