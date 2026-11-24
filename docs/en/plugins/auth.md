---
outline: deep
---

# Authentication

Separate two concerns first: **who is this person** (authentication), and **can they do this** (authorization). `@aomex/auth` folds multiple strategies into one Auth instance: failed identity is usually **401**; identity present but insufficient permission is **403**. Frontends and monitoring can tell “go log in” from “switch account / raise privileges”.

Put “must be logged in” on a group of business APIs, with a few routes needing a higher role; the login route itself doesn’t mount auth, and after login you can read the identity on ctx.auth.

## Install

Install packages for the strategies you actually use; if you haven’t built login yet, treat this page as a roadmap.

```bash
pnpm add @aomex/auth
# JWT separately: pnpm add @aomex/auth-jwt-strategy
# Session also needs: pnpm add @aomex/cache (add @aomex/cors @aomex/csrf for cross-origin)
```

| Strategy package | Typical use |
| --- | --- |
| [`@aomex/auth/bearer`](/en/plugins/auth-bearer-strategy) | Opaque token, server-side session |
| [`@aomex/auth/session`](/en/plugins/auth-session-strategy) | Browser Cookie login; with CORS + CSRF |
| [`@aomex/auth/api-key`](/en/plugins/auth-api-key-strategy) | Machine-to-machine, open platforms |
| [`@aomex/auth-jwt-strategy`](/en/plugins/auth-jwt-strategy) | Self-contained JWT, fewer DB lookups |
| [`@aomex/oauth2-client`](/en/plugins/oauth2-client) | Third-party authorization-code login; common vendors have [aomex-contrib](https://github.com/aomex/aomex-contrib) presets (not an Auth strategy; after callback you issue one of the strategies above) |

## Private APIs: authenticate on Router

Register strategies on an `Auth` instance (Bearer / Session / API Key / JWT); `authenticate(name)` returns middleware that checks identity first. When a whole group of APIs must require login, mount it on `Router.mount`; after success, `ctx.auth[name]` holds the identity.

```typescript
import { Auth } from '@aomex/auth';
import { AuthBearerStrategy } from '@aomex/auth/bearer';
import { Router } from '@aomex/web';

const auth = new Auth({
  strategies: {
    bearer: new AuthBearerStrategy({
      onLoaded: async (token) => {
        const user = await findUserByToken(token);
        return user ?? false; // false → 401
      },
      onAuthorize(minRole: number) {
        return this.getIdentity().role >= minRole;
      },
    }),
  },
});

export const router = new Router({ // [!code focus:10]
  prefix: '/api',
  mount: [auth.authenticate('bearer')], // [!code highlight]
});

router.get('/profile', {
  action: async (ctx) => {
    ctx.send(ctx.auth.bearer.data);
  },
});

router.delete('/posts/:id', {
  mount: [auth.authorize('bearer', 10)],
  action: async (ctx) => {
    ctx.send(204, null);
  },
});
```

- `ctx.auth.bearer` only makes sense after `authenticate('bearer')` is mounted and passed; the type includes a field for that strategy name.
- The second argument to `authorize('bearer', 10)` follows the `onAuthorize` signature you wrote on the strategy (number, permission codes, etc.). Failure is usually **403**—this assumes authentication for that strategy has **already** run; mounting only authorize without authenticate won’t get the same runtime safety as the types suggest.

When one route needs “log in first, then check permission”, you can chain:

```typescript
router.post('/admin/reboot', {
  mount: [auth.authenticate('bearer').authorize(99)], // [!code highlight]
  action: async (ctx) => {
    // …
  },
});
```

## How login issues credentials

On login and token refresh, issue credentials in business code with `auth.strategy(name)` (Bearer random string, JWT payload, etc.). **Don’t mount authenticate on the login route**, or requests without a token can never get in.

```typescript
// Issue after successful login (example)
const token = auth.strategy('bearer').signature('sha256', user.id);
```

## Don’t force public routes into an authenticated Router

| Placement | Best for |
| --- | --- |
| `Router.mount` | A whole private API group |
| Per-route `mount` | Occasional public / stricter auth; when mixed with public routes in one file |
| `WebApp.mount` | Almost the entire site private; health checks need a separate Router |

Don’t force public routes into an already-authenticated Router: a separate Router without authenticate is easier to maintain than skipping everywhere. Repeated `authorize(...)` can be extracted to constants.

Use **401** for not logged in / invalid token; use **403** only when logged in but the role isn’t enough—don’t mix those meanings. When generating OpenAPI, pass the same `app` as production to `generateOpenapi` so document security matches real auth. With multiple strategies, names like `authenticate('jwt')` must match the keys in strategies.

## Related

- [Bearer strategy](/en/plugins/auth-bearer-strategy)
- [Session strategy](/en/plugins/auth-session-strategy)
- [API Key strategy](/en/plugins/auth-api-key-strategy)
- [JWT strategy](/en/plugins/auth-jwt-strategy)
- Third-party authorization-code login: [OAuth2 client](/en/plugins/oauth2-client)
- Unusual protocols: [Advanced: custom auth strategy](/en/advanced/auth-strategy)
