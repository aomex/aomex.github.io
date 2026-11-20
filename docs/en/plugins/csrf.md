---
outline: deep
---

# CSRF protection

Browsers attach same-site Cookies automatically. If an attacker’s page tricks your browser into POSTing to your API, the **HttpOnly login Cookie rides along**—that is cross-site request forgery. `@aomex/csrf` uses the **double-submit Cookie** pattern: the server issues a readable `csrfToken` Cookie; the front end echoes the same value in a request header; writes are allowed only when both match.

Almost always pair it with [Session](/en/plugins/auth-session-strategy). If you authenticate only via Bearer headers and never rely on Cookie login state, you usually can skip CSRF.

```bash
pnpm add @aomex/csrf
```

## Mount before routers

Bare `csrf()` is enough: GET/HEAD/OPTIONS only issue or reuse the Cookie; mutating methods require the Cookie to match `x-csrf-token`, otherwise **403**.

```typescript
import { cors } from '@aomex/cors';
import { csrf } from '@aomex/csrf';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'en-US' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:5]
    cors({ origin: 'https://app.example.com', credentials: true }),
    csrf(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

::: warning
Must sit **before** routers. If csrf runs after the error pipeline clears headers, a freshly issued `Set-Cookie` may never reach the browser and the client stays tokenless.
:::

The middleware sets `ctx.csrfToken` (current token string). The Cookie is forced to `httpOnly: false` (JS must read it); other attributes (`sameSite` / `path` / `maxAge`) are configurable and otherwise follow `setCookie` defaults (including `SameSite=Strict`).

When login Cookies also cross origins, CORS needs `credentials: true` plus an **explicit** `origin`, and `allowHeaders` must permit `x-csrf-token`. See [CORS](/en/plugins/cors) and [Session](/en/plugins/auth-session-strategy).

## What the front end sends

1. Hit any GET (or load the page) so the response includes `Set-Cookie: csrfToken=...`
2. Read the value from `document.cookie` (or your cookie helper)
3. On writes, set header `x-csrf-token: <same value>` and use `credentials: 'include'` if you also depend on the login Cookie

```typescript
function readCsrfToken() {
  const row = document.cookie
    .split('; ')
    .find((line) => line.startsWith('csrfToken='));
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

A first POST with no Cookie yet returns **403**, but the response may still carry a new `Set-Cookie`—read it and retry.

## Options and skips

| Option | When to use | Default |
| --- | --- | --- |
| `cookie.name` | Match an existing front-end convention | `csrfToken` |
| `cookie.sameSite` / `path` / `maxAge` / `secure` | Cross-site front ends, path isolation, expiry | Same as `setCookie`; `httpOnly` fixed `false` |
| `headerName` | Front end already uses another header | `x-csrf-token` |
| `ignoreMethods` | Methods that skip checks | `GET`, `HEAD`, `OPTIONS` |
| `ignore` | Health checks, external webhooks per request | — |

```typescript
csrf({
  cookie: { sameSite: 'lax', maxAge: 86400 },
  headerName: 'x-xsrf-token',
  ignore: (ctx) => {
    return ctx.request.pathname.startsWith('/webhooks/');
  },
});
```

Reads only Header + Cookie—**never the body**—so it does not interfere with `body()`. Prefer `ignore` for non-browser webhooks; do not turn CSRF off globally.

## Related

- [Session strategy](/en/plugins/auth-session-strategy)
- [CORS](/en/plugins/cors)
- [Helmet](/en/plugins/helmet)
