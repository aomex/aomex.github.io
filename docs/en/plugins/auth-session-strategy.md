---
outline: deep
---

# Session strategy

Browser login state lives in an **HttpOnly Cookie**: the Cookie holds only an opaque `sessionId`, while user data sits in a `@aomex/cache` adapter (memory / Redis). For a cross-origin SPA you also need [CORS](/en/plugins/cors) (to send Cookies) and [CSRF](/en/plugins/csrf) (to block cross-site writes)—miss either piece and the session either never arrives or can be abused by a third-party page.

Prefer this when you have a trusted browser front end and want server-side revocation. Native apps and machine clients usually fit [Bearer](/en/plugins/auth-bearer-strategy) or [JWT](/en/plugins/auth-jwt-strategy) better.

## Install

Session ships with `@aomex/auth`; you also need `@aomex/cache` (and a Redis adapter in production). Add CORS / CSRF for cross-origin Cookie flows.

```bash
pnpm add @aomex/auth @aomex/cache
# Cross-origin Cookie: pnpm add @aomex/cors @aomex/csrf
# Shared sessions across instances: pnpm add @aomex/cache-redis-adapter
```

```typescript
import { AuthSessionStrategy } from '@aomex/auth/session';
```

## Mount CORS and CSRF first

Cross-origin front ends that send Cookies need:

1. Requests with `credentials: 'include'` (or XHR `withCredentials`)
2. Responses with `Access-Control-Allow-Credentials: true` and a **concrete** `Access-Control-Allow-Origin` (never `*`)
3. CSRF headers on write methods—otherwise another site can ride your Cookie

With `credentials: true` you **must** set `origin` explicitly; the default reflect behavior of bare `cors()` is rejected at startup. CSRF uses the double-submit Cookie pattern: readable Cookie `csrfToken` must match header `x-csrf-token`.

```typescript
import { cors } from '@aomex/cors';
import { csrf } from '@aomex/csrf';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'en-US' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:8]
    cors({
      origin: 'https://app.example.com',
      credentials: true,
      allowHeaders: ['Content-Type', 'x-csrf-token'],
    }),
    csrf(),
    routers('./src/routers'),
  ],
});
```

::: tip
For local split-port setups, set origin to `http://localhost:5173` (or your front-end URL)—never `*`. Same-origin deploys can skip cors(), but CSRF is still recommended.
:::

Order: cors → csrf → routers. Both must sit **before** routers so error responses still carry CORS headers and a freshly issued CSRF Cookie.

A mutating front-end call looks roughly like:

```typescript
const csrfToken = document.cookie
  .split('; ')
  .find((row) => row.startsWith('csrfToken='))
  ?.split('=')[1];

await fetch('https://api.example.com/api/posts', {
  method: 'POST',
  credentials: 'include', // [!code highlight]
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken!, // [!code highlight]
  },
  body: JSON.stringify({ title: 'hi' }),
});
```

Safe methods such as GET skip CSRF by default; the first visit issues a `csrfToken` Cookie (`HttpOnly=false` so JS can read it). Details: [CSRF](/en/plugins/csrf).

## store, cookie, and onLoaded

`cookie.maxAge` (seconds) is required and doubles as the cache TTL. `onLoaded` turns Stored cache data into a business identity; return `false` for revoked users → **401**.

```typescript
import { Auth } from '@aomex/auth';
import { AuthSessionStrategy } from '@aomex/auth/session';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import { body, Router } from '@aomex/web';
import { rule } from '@aomex/common';

const auth = new Auth({
  strategies: {
    session: new AuthSessionStrategy({
      store: new CacheMemoryAdapter(), // [!code highlight]
      cookie: {
        maxAge: 7 * 24 * 3600,
        // Cross-site front ends often need: sameSite: 'none', secure: true
      },
      onLoaded: async (data: { userId: number }) => {
        const user = await findActiveUser(data.userId);
        return user ?? false;
      },
      onAuthorize(minRole: number) {
        return this.getIdentity().role >= minRole;
      },
    }),
  },
});
```

Use Redis (or another shared adapter) in production / multi-instance setups—see [Cache](/en/core/cache). Default Cookie name is `sessionId`; `setCookie` defaults to `httpOnly: true` and `sameSite: Strict` (cross-site front ends need `'none'` plus `secure`).

| Option | When to use |
| --- | --- |
| `store` | Where sessions live; memory locally, Redis across replicas |
| `cookie.maxAge` | Session lifetime in seconds; **required** |
| `cookie.name` / `path` / `domain` / `sameSite` / `secure` | Align with front-end origin and cross-site needs |
| `sliding` | Renew TTL + Cookie on every successful auth |
| `generateCacheKey` | Custom key prefix; default `auth:session:${sessionId}` |
| `onLoaded` | Stored → identity; DB lookup / revoke |
| `onAuthorize` | Only when you call `authorize(role)` |

## Login, authenticate, logout

Do **not** mount `authenticate` on the login route. Call `strategy.login(ctx, stored)` to write the cache and set the Cookie (issues a new `sessionId`; if the request already carried an old Cookie, the old session is deleted after the new one is written). Protect private routes with `authenticate('session')` and read `ctx.auth.session`.

```typescript
const session = auth.strategy('session');

export const publicRouter = new Router({ prefix: '/api' });

publicRouter.post('/login', { // [!code focus:12]
  mount: [body({ email: rule.email(), password: rule.string() })],
  action: async (ctx) => {
    const user = await verifyPassword(ctx.body);
    if (!user) {
      return ctx.throw(401, 'invalid credentials');
    }

    await session.login(ctx, { userId: user.id }); // [!code highlight]
    ctx.send({ ok: true });
  },
});

publicRouter.post('/logout', {
  action: async (ctx) => {
    await session.logout(ctx);
    ctx.send(204, null);
  },
});

export const privateRouter = new Router({
  prefix: '/api',
  mount: [auth.authenticate('session')],
});

privateRouter.get('/me', {
  action: async (ctx) => {
    ctx.send(ctx.auth.session.data); // [!code highlight]
  },
});
```

After a successful auth:

```typescript
ctx.auth.session // { sessionId: string; data: Loaded }
```

`data` is whatever `onLoaded` returned. `logout` deletes the cache entry and clears the Cookie; `touch` only renews TTL. After a privilege upgrade or sensitive action, call `regenerateSessionId(ctx)` to rotate the id (optionally pass a new Stored payload).

::: warning
Cross-origin clients must use `credentials: 'include'`, or the browser will not send the `sessionId` Cookie—login looks fine, then every call is **401**.
:::

## Session vs Bearer / JWT

| | Session | Bearer / JWT |
| --- | --- | --- |
| Where credential lives | HttpOnly Cookie | Header / local storage |
| Cross-origin | CORS credentials + usually CSRF | Typically just `Authorization` |
| Revocation | Delete cache entry | Bearer: delete session; JWT: short TTL / denylist |
| Typical client | Browser SPA / admin UI | Apps, open platforms, service-to-service |

Same-origin admin UIs lean Session; public APIs lean Bearer or JWT. Overview: [Authentication](/en/plugins/auth).

## Related

- [CORS](/en/plugins/cors)
- [CSRF](/en/plugins/csrf)
- [Authentication](/en/plugins/auth)
- [Cache](/en/core/cache)
- [Bearer strategy](/en/plugins/auth-bearer-strategy)
