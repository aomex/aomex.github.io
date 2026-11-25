---
outline: deep
---

# Session strategy

Browser login state lives in an **HttpOnly Cookie**: the Cookie only holds an opaque `sessionId`; user data sits in an `@aomex/cache` adapter (memory / Redis). Cross-origin SPAs also need both [CORS](/en/plugins/cors) (with cookies) and [CSRF](/en/plugins/csrf) (to stop cross-site writes)—miss either piece and the session either never arrives or can be abused by third-party sites.

Fits “same-site or trusted frontend + server can kill the session anytime”; pure mobile / machine clients more often use [Bearer](/en/plugins/auth-bearer-strategy) or [JWT](/en/plugins/auth-jwt-strategy).

## Install

Session strategy ships with the `@aomex/auth` main package; storing sessions also needs `@aomex/cache` (and a Redis adapter in production). For cross-origin Cookie scenarios, add CORS / CSRF as well.

```bash
pnpm add @aomex/auth @aomex/cache
# Cross-origin Cookie: pnpm add @aomex/cors @aomex/csrf
# Shared sessions across instances: pnpm add @aomex/cache-redis-adapter
```

```typescript
import { AuthSessionStrategy } from '@aomex/auth/session';
```

## Mount CORS and CSRF first

A cross-origin frontend that sends cookies requires:

1. The request uses `credentials: 'include'` (or XHR `withCredentials`)
2. The response has `Access-Control-Allow-Credentials: true`, and `Access-Control-Allow-Origin` is a **concrete origin** (not `*`)
3. Writes carry a CSRF header—otherwise someone else’s page can “borrow” your Cookie to POST

With `credentials: true` you **must set `origin` explicitly**—you cannot rely on parameterless `cors()` reflecting the request; startup throws otherwise. CSRF uses a double-submit Cookie: the readable `csrfToken` Cookie must match the `x-csrf-token` request header.

```typescript
import { cors } from '@aomex/cors';
import { csrf } from '@aomex/csrf';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
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
When debugging on split local ports, set `origin` to `http://localhost:5173` (or your frontend URL)—not `*`. Same-site deploys (same origin for frontend and API) can omit `cors()`, but CSRF is still recommended.
:::

Mount order: cors → csrf → routers. Both must sit **before** routers so error responses still carry CORS / a freshly issued CSRF Cookie.

A typical frontend write looks like:

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

Safe methods such as GET skip CSRF by default; the first visit issues a `csrfToken` Cookie (`HttpOnly=false`, readable by JS). Details: [CSRF](/en/plugins/csrf).

## store, cookie, and onLoaded

`cookie.maxAge` (seconds) is required and also acts as the cache TTL. `onLoaded` turns the Stored value from cache into a business identity; return `false` if the user has logged out → **401**.

```typescript
import { Auth } from '@aomex/auth';
import { AuthSessionStrategy } from '@aomex/auth/session';
import { Caching } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import { body, Router } from '@aomex/web';
import { rule } from '@aomex/common';

const cache = new Caching(new CacheMemoryAdapter());

const auth = new Auth({
  strategies: {
    session: new AuthSessionStrategy({
      store: cache, // [!code highlight]
      cookie: {
        maxAge: 7 * 24 * 3600,
        // Cross-site frontend in production often: sameSite: 'none', secure: true
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

In production or multi-instance setups, switch to Redis or another external adapter—see [Cache](/en/core/cache). Default Cookie name is `sessionId`; `setCookie` defaults to `httpOnly: true`, `sameSite: Strict` (cross-site frontends need `'none'` plus `secure`). Align `cookie.name` / `path` / `domain` with the frontend origin.

To avoid kicking active users offline, turn on `sliding`: each successful auth renews TTL + Cookie. Customize the cache key prefix with `generateCacheKey` (default `auth:session:${sessionId}`). Write `onAuthorize` when you need `authorize(role)`.

## Login, auth, logout

Do **not** mount `authenticate` on the login route. Use `strategy.login(ctx, stored)` to write the cache and set the Cookie (issues a new `sessionId`; if the request already had an old Cookie, the old session is deleted after a successful write). Private routes mount `authenticate('session')` and read `ctx.auth.session`.

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

After successful auth:

```typescript
ctx.auth.session // { sessionId: string; data: Loaded }
```

`data` is the return value of `onLoaded`. `logout` deletes the cache and clears the Cookie; `touch` only renews without changing stored content. After privilege elevation or sensitive actions, call `regenerateSessionId(ctx)` to rotate the id (optionally with new Stored data).

::: warning
Across origins the frontend must use `credentials: 'include'`, or the browser will not send the `sessionId` Cookie—it looks like “login succeeded then instant 401”.
:::

## Choosing vs Bearer / JWT

| | Session | Bearer / JWT |
| --- | --- | --- |
| Where credentials live | HttpOnly Cookie | Header / local storage |
| Cross-origin | Needs CORS credentials + often CSRF | Usually just `Authorization` |
| Revocation | Delete the cache | Bearer: delete session; JWT: short TTL / blacklist |
| Typical clients | Browser SPA / admin | Apps, open platforms, service-to-service |

Prefer Session for same-site admin UIs; prefer Bearer or JWT for open APIs. Overview: [Authentication](/en/plugins/auth).

## Related

- [CORS](/en/plugins/cors)
- [CSRF](/en/plugins/csrf)
- [Authentication](/en/plugins/auth)
- [Cache](/en/core/cache)
- [Bearer strategy](/en/plugins/auth-bearer-strategy)
