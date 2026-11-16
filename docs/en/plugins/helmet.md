---
outline: deep
---

# Helmet security headers

Adds a sensible default set of HTTP security headers for browser-facing responses (clickjacking, MIME sniffing, etc.). Optional for pure JSON APIs; common default when you serve H5, admin UIs, or doc sites—tighten CSP to match real assets.

Built on upstream [helmet](https://github.com/helmetjs/helmet); options match `HelmetOptions`—see [helmet docs](https://helmetjs.github.io/).

```bash
pnpm add @aomex/helmet
```

## Default bundle on WebApp

Parameterless `helmet()` applies upstream defaults; typical for `WebApp.mount` when HTML, docs, or admin exist—omit for JSON-only APIs if you prefer.

```typescript
import { helmet } from '@aomex/helmet';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    helmet(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

With [CORS](/en/plugins/cors), put both before `routers`; headers can also live on the reverse proxy—in-app mount eases per-environment toggles.

Plain `WebMiddleware`—no business `ctx` fields. DevTools → Network → response headers show `X-Content-Type-Options`, `X-Frame-Options`, etc. (exact set depends on defaults and sub-options).

## CSP and environment branches

| Capability | When to use | Typical default |
| --- | --- | --- |
| Parameterless bundle | Production Web / browser-used API | Common protections on |
| `contentSecurityPolicy` | Frontend pages, XSS mitigation | Whitelist CDN/script hosts |
| `contentSecurityPolicy: false` | Swagger/ReDoc inline scripts blocked | Often dev or doc routes only |
| `NODE_ENV` branch | Looser local, tighter prod | see demo below |

### Production: tightened CSP (skeleton)

```typescript
helmet({
  contentSecurityPolicy: { // [!code highlight]
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
    },
  },
});
```

### Development vs production

```typescript
const security =
  process.env.NODE_ENV === 'production'
    ? helmet()
    : helmet({ contentSecurityPolicy: false }); // [!code highlight]

mount: [security, cors(), routers('./src/routers')];
```

| Environment | Guidance |
| --- | --- |
| Production (admin / H5) | Enable; CSP against frontend asset list |
| Production (JSON only, no HTML) | Optional; skip if gateway already sets headers |
| Local | Docs / Swagger may use `contentSecurityPolicy: false` |

Copy-paste CSP without CDN/script hosts → blank pages and console CSP errors. Disabling CSP in prod widens inline script risk. Helmet does **not** replace [CORS](/en/plugins/cors)—configure cross-origin separately.

## Next steps

- Cross-origin: [CORS](/en/plugins/cors)
- Public API doc UIs: [Swagger UI](/en/plugins/swagger-ui), [Redoc UI](/en/plugins/redoc-ui)
- Middleware placement: [Middleware](/en/core/middleware)