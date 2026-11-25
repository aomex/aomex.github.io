---
outline: deep
---

# Security headers with Helmet

Add a sensible default set of HTTP security headers to browser-facing responses (clickjacking, MIME sniffing, and similar) to reduce common frontend risks. Optional for pure JSON APIs; with H5, admin UIs, or doc sites, a common approach is to mount by default and tighten CSP against real assets later.

Built on upstream [helmet](https://github.com/helmetjs/helmet); options match its HelmetOptions—see the [helmet docs](https://helmetjs.github.io/) for details.

```bash
pnpm add @aomex/helmet
```

## Default full set on WebApp

Parameterless `helmet()` applies upstream’s default browser security headers; with HTML, doc sites, or admin UIs, a common approach is to put it in `WebApp.mount`. Pure JSON APIs can omit it when you do not need it.

```typescript
import { helmet } from '@aomex/helmet';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'en-US' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    helmet(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

Together with [CORS](/en/plugins/cors), both go before routers; headers can also be set at the reverse proxy—mounting in the app makes per-environment switches easier.

Returns plain WebMiddleware; no business `ctx` fields. In browser DevTools → Network → response headers you should see X-Content-Type-Options, X-Frame-Options, and similar (exact mix depends on helmet defaults and sub-options).

## CSP and environment branches

With frontend pages, tighten `contentSecurityPolicy` on top of the parameterless full set: whitelist CDN / script origins. When Swagger / ReDoc inline scripts fail to start, temporarily set `contentSecurityPolicy: false` on the doc route or in development.

Tighten CSP in production (skeleton—adjust to real assets):

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

Less friction locally, tighter in production—a common environment branch:

```typescript
const security =
  process.env.NODE_ENV === 'production'
    ? helmet()
    : helmet({ contentSecurityPolicy: false }); // [!code highlight]

mount: [security, cors(), routers('./src/routers')];
```

| Environment | Recommendation |
| --- | --- |
| Production (admin / H5) | Enable; align CSP with the frontend asset list |
| Production (JSON only, no HTML) | Optional; omit if the gateway already sets headers |
| Local | Doc sites / Swagger can use `contentSecurityPolicy: false` |

Copying a strict CSP template without allowing CDN / script origins blanks the page and floods the console with CSP errors. Turning CSP off in production for convenience widens the inline-script surface—opposite of a tighten-on-ship goal. Helmet does **not** replace [CORS](/en/plugins/cors); cross-origin still needs its own config.

## Next steps

- Cross-origin: [CORS](/en/plugins/cors)
- Cookie login forgery protection: [CSRF](/en/plugins/csrf)
- Public API docs UI: [Swagger UI](/en/openapi/swagger-ui), [Redoc UI](/en/openapi/redoc-ui)
- Where middleware mounts: [Middleware](/en/core/middleware)
