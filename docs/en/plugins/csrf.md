---
outline: deep
---

# CSRF Protection

Browsers automatically send same-site cookies. If an attacker’s page tricks your browser into POSTing to your API, **an HttpOnly login cookie is still sent**—that’s cross-site request forgery. `@aomex/csrf` uses the **double-submit cookie** pattern: the server issues a readable `csrfToken` cookie, the frontend puts the same value in a request header, and write methods only pass when both match.

It almost always pairs with [Session](/en/plugins/auth-session-strategy). If you only use a Bearer header and don’t rely on cookie login state, you usually don’t need CSRF.

```bash
pnpm add @aomex/csrf
```

## Mount before routers

A no-arg `csrf()` is enough: GET/HEAD/OPTIONS only issue or reuse the cookie and don’t check the header; POST and other write methods require the cookie and `x-csrf-token` to match, otherwise **403**.

```typescript
import { cors } from '@aomex/cors';
import { csrf } from '@aomex/csrf';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:5]
    cors({ origin: 'https://app.example.com', credentials: true }),
    csrf(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

::: warning
You must mount it **before** routers. When validation fails and the request goes through the error middleware, if csrf sits after routers, a freshly issued `Set-Cookie` may never reach the browser, and the frontend keeps missing the token.
:::

The middleware attaches `csrfToken` (the current token string) on ctx. The cookie is **forced** to `httpOnly: false` (double-submit needs JS to read it); other attributes (`sameSite` / `path` / `maxAge`) are configurable and default to the same as `setCookie` (including `SameSite=Strict`).

When cross-origin requests also need the login cookie, CORS must use `credentials: true` and an **explicit** `origin`, and allow `x-csrf-token` in `allowHeaders`. See [CORS](/en/plugins/cors) and [Session](/en/plugins/auth-session-strategy).

## How the frontend sends it

1. First send any GET (or open the page); the response includes `Set-Cookie: csrfToken=...`
2. Read the value with `document.cookie` (or your cookie helper)
3. On write requests, set the header `x-csrf-token: <same value>`, and use `credentials: 'include'` if you also rely on the login cookie

```typescript
function readCsrfToken() {
  const row = document.cookie
    .split('; ')
    .find((line) => {
      return line.startsWith('csrfToken=');
    });
  return row?.slice('csrfToken='.length);
}

await fetch('/api/orders', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': readCsrfToken()!, // [!code highlight]
  },
  body: JSON.stringify({ sku: 'A1' }),
});
```

If the first request is a POST to an interface that needs the cookie: you get **403**, but the response may still include a newly issued `Set-Cookie`—read it on the frontend and retry.

## Align with frontend conventions

If the frontend already uses `x-xsrf-token`, or the cookie name isn’t `csrfToken`, align them in the constructor options; `httpOnly` is still forced off.

```typescript
csrf({
  cookie: { name: 'XSRF-TOKEN', sameSite: 'lax', maxAge: 86400 }, // [!code highlight]
  headerName: 'x-xsrf-token',
});
```

`sameSite` / `path` / `secure` / `maxAge` follow your business cookie policy; cross-site frontends often set `sameSite` to `lax`.

## Allow webhooks and health checks

Third-party callbacks and load-balancer probes have no browser cookie and shouldn’t go through double-submit. Use `ignore` to skip by path; don’t turn CSRF off globally.

```typescript
csrf({
  ignore: (ctx) => { // [!code focus:3]
    return ctx.request.pathname.startsWith('/webhooks/');
  },
});
```

It only reads Header + Cookie, **not the body**, so it doesn’t interfere with `body()` parsing. Methods that skip validation by default are GET / HEAD / OPTIONS; you rarely need to change `ignoreMethods`.

## Related

- [Session strategy](/en/plugins/auth-session-strategy)
- [CORS](/en/plugins/cors)
- [Helmet](/en/plugins/helmet)
