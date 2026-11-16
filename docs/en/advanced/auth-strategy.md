---
outline: deep
---

# Custom auth strategies

[Bearer](/en/plugins/auth-bearer-strategy), [API Key](/en/plugins/auth-api-key-strategy), and [JWT](/en/plugins/auth-jwt-strategy) already cover most “token / key in header” APIs. You customize when credential shape does not fit those plugins but you still want:

- One path through `auth.authenticate` / `authorize`  
- **401** when not logged in, **403** when not allowed  
- `ctx.auth.<strategyName>.data` in handlers  
- Matching security in OpenAPI  

Typical cases: cookie sessions, gateway-injected headers, identities from mTLS. If you only need `user` on `ctx` and do not care about Auth conventions, plain middleware works—but you own security and unauthenticated branches.

Below is **cookie session** from scratch through mounting on routes.

## Step 1: Decide what identity looks like

Fix the payload after login, e.g. `{ userId: number }`. That becomes the strategy’s first generic and the type of `ctx.auth.session.data`.

The second generic is `authorize` arguments, e.g. role names: `[string]` → later `.authorize('admin')`.

## Step 2: Implement `authenticate` (collect credentials)

Read credentials from the request; missing or invalid should follow the contract below—**do not throw uncaught errors** (clients often see 500 and assume the service is down).

```typescript
// src/auth/session.strategy.ts
import { Strategy, AuthError } from '@aomex/auth';
import type { WebContext } from '@aomex/web';

export class SessionStrategy extends Strategy<{ userId: number }, [string]> {
  protected async authenticate(ctx: WebContext) {
    const sid = ctx.request.cookies?.['sid']; // [!code highlight]
    if (!sid) {
      return false; // → 401 not logged in
    }
    const user = await findBySession(sid);
    if (!user) {
      return new AuthError('session expired'); // → 401 with message
    }
    return { userId: user.id }; // → written to ctx.auth
  }

  protected async authorize(role: string) {
    const identity = this.getIdentity();
    return userHasRole(identity.userId, role);
  }
}
```

`authenticate` return values:

| Return | Behavior |
| --- | --- |
| Identity object | Stored on `ctx.auth`, continue pipeline |
| `false` | Not logged in → **401** |
| `AuthError` | Auth failure with message → **401** |

`authorize` returning falsy or `AuthError` → **403**. In `authorize`, `this.getIdentity()` is the object from a successful `authenticate`.

## Step 3: Hand off to Auth—the key is the strategy name

```typescript
// src/auth/index.ts
import { Auth } from '@aomex/auth';
import { SessionStrategy } from './session.strategy.js';

export const auth = new Auth({
  strategies: {
    session: new SessionStrategy(), // [!code highlight]
  },
});
```

The key `session` drives three things:

1. `auth.authenticate('session')`  
2. `ctx.auth.session`  
3. Shape of `ctx.auth.session.data` (from the strategy generic)

## Step 4: Mount and exercise on routes

Split **public login** and **protected** routes into separate `Router`s (or `.skip` on the auth chain—see [Middleware](/en/core/middleware)). Do not pile everything in one group and hope auth “just skips.”

```typescript
import { Router } from '@aomex/web';
import { auth } from '../auth/index.js';

export const router = new Router({
  prefix: '/admin',
  mount: [auth.authenticate('session')], // whole group requires login
});

router.get('/dashboard', {
  mount: [auth.authenticate('session').authorize('admin')], // [!code highlight]
  action: async (ctx) => {
    const userId = ctx.auth.session.data.userId;
    ctx.send({ userId });
  },
});
```

You can mount `authenticate` on a single route’s `mount` instead of router-level. Chained `.authorize('admin')` does not change `data` type; the framework returns 403 on failure—you usually do not re-check roles in the action (finer business rules are separate).

Manual checks:

1. No cookie → **401**  
2. Cookie but insufficient role → **403**  
3. Success → `userId` completes in the action  

## Step 5: OpenAPI security

Custom strategies get 401 responses from the base `openapi()` by default. Without a security scheme, Swagger “Authorize” will not match your cookie / custom header, and clients generated as Bearer will keep hitting **401**.

Override `openapi()` on the strategy (fields per type hints; compare the Bearer plugin):

```typescript
import type { OpenApiInjector } from '@aomex/web';

protected override openapi(): OpenApiInjector {
  return {
    ...super.openapi(),
    onDocument(document) {
      document.components ||= {};
      document.components.securitySchemes ||= {};
      document.components.securitySchemes['sessionCookie'] ||= {
        type: 'apiKey',
        in: 'cookie',
        name: 'sid',
      };
    },
    onMethod(methodItem) {
      methodItem.security ||= [];
      methodItem.security.push({ sessionCookie: [] });
    },
  };
}
```

Regenerate OpenAPI and confirm security and 401 descriptions on affected operations.

::: warning
Cookie names, header names, and security metadata must match how you read credentials, or integration will loop on **401**.
:::

## When not to customize

| Situation | Approach |
| --- | --- |
| Standard Bearer / JWT / API Key | Plugin strategies |
| Cookie, gateway headers, custom signing | Custom `Strategy` (this page) |
| Health checks, static pages | Separate router or `.skip`; see [Middleware](/en/core/middleware) |

## JWT asymmetric keys and rotation (still use the plugin)

Custom strategies solve **how you collect credentials**; JWT algorithms and rotation stay on the [JWT strategy](/en/plugins/auth-jwt-strategy)—no need to rewrite:

```typescript
import { AuthJwtStrategy } from '@aomex/auth-jwt-strategy';
import fs from 'node:fs';

new AuthJwtStrategy({
  publicKey: fs.readFileSync('public.pem'),
  privateKey: fs.readFileSync('private.pem'),
  verifyOptions: { algorithms: ['RS256'] }, // [!code highlight]
  legacySecretOrPublicKey: [oldSecret],
  onVerified: (payload) => {
    return payload;
  },
});
```

## Related

- Entry point and built-in strategies: [Auth](/en/plugins/auth)
- 401 / 403 JSON: [Error format](/en/web/errors)