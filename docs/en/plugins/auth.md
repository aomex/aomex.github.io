---
outline: deep
---

# Authentication

Two ideas: **who you are** (authentication) and **what you may do** (authorization). `@aomex/auth` bundles strategies in one `Auth` instance—failed identity is usually **401**, insufficient permission **403**. Frontends and monitoring can tell “re-login” vs “wrong account / need higher role”.

Add “must be logged in” for a route group, tighten a few routes with roles; login routes stay open; after login read identity from `ctx.auth`.

## Install

Install packages for the strategies you use; treat this page as a roadmap before login exists.

```bash
pnpm add @aomex/auth
# JWT also: pnpm add @aomex/auth-jwt-strategy
# Session also needs: pnpm add @aomex/cache (plus @aomex/cors @aomex/csrf cross-origin)
```

| Strategy package | Typical use |
| --- | --- |
| [`@aomex/auth/bearer`](/en/plugins/auth-bearer-strategy) | Opaque token, server-side session |
| [`@aomex/auth/session`](/en/plugins/auth-session-strategy) | Browser Cookie login; pair with CORS + CSRF |
| [`@aomex/auth/api-key`](/en/plugins/auth-api-key-strategy) | Machine-to-machine, open platform |
| [`@aomex/auth-jwt-strategy`](/en/plugins/auth-jwt-strategy) | Self-contained JWT, fewer DB lookups |

## Mount authenticate on Router

Register strategies on `Auth` (Bearer / Session / API Key / JWT); `authenticate(name)` returns identity middleware for `Router` or single routes. After success read `ctx.auth[name]`; use per-route `authorize` for fine-grained permission.

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

Chain on one route:

```typescript
router.post('/admin/reboot', {
  mount: [auth.authenticate('bearer').authorize(99)], // [!code highlight]
  action: async (ctx) => {
    // …
  },
});
```

- `ctx.auth.bearer` matters after `authenticate('bearer')` passes; types include the strategy name.
- Second arg to `authorize('bearer', 10)` follows your `onAuthorize` signature (number, permission code, etc.).
- `auth.strategy('bearer').signature(...)` belongs on **login actions** for issuing tokens—not on auth middleware.

```typescript
// after successful login (example)
const token = auth.strategy('bearer').signature('sha256', user.id);
```

## authenticate(name)

| When | Where |
| --- | --- |
| Whole group must log in | `Router.mount` |
| Mixed public/private in one file | Per-route `mount`, or split Routers |

Flow: strategy failure → **401**; success writes `ctx.auth[name]`. Returned middleware has `.authorize(...)` for chaining. **401** for missing/invalid token; **403** when logged in but not allowed—keep semantics separate.

### authorize(name, ...args)

Assumes **already** authenticated with that strategy. `authorize` without prior `authenticate` will not save you at runtime—mind mount order. Failure is usually **403**.

### strategy(name)

Issue credentials in login/refresh flows (Bearer random string, JWT payload, etc.). **Do not mount authenticate on login routes** or clients without tokens never enter.

### Where to mount

| Placement | Fits | Note |
| --- | --- | --- |
| `Router.mount` | Whole private API group | Do not mix public routes in the same file |
| Per-route `mount` | Few public / stricter auth | Extract constants when repeating |
| `WebApp.mount` | Almost entire site private | Health checks need another Router |

Prefer a separate Router without `authenticate` for public APIs over sprinkling `skip`.

Pass the same `app` as production to `generateOpenapi` so OpenAPI `security` matches real auth. With multiple strategies, `authenticate('jwt')` names must match `strategies` keys.

## Related

- [Bearer strategy](/en/plugins/auth-bearer-strategy)
- [Session strategy](/en/plugins/auth-session-strategy)
- [API Key strategy](/en/plugins/auth-api-key-strategy)
- [JWT strategy](/en/plugins/auth-jwt-strategy)
- Unusual protocols: [Advanced: custom auth strategies](/en/advanced/auth-strategy)