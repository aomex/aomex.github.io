---
outline: deep
---

# Custom auth strategies

[Bearer](/en/plugins/auth-bearer-strategy), [API Key](/en/plugins/auth-api-key-strategy), [JWT](/en/plugins/auth-jwt-strategy), and [Session](/en/plugins/auth-session-strategy) already cover common credential shapes. You customize when none of those fit but you still want:

- One path through `auth.authenticate` / `authorize`  
- **401** when not logged in, **403** when not allowed  
- `ctx.auth.<strategyName>.data` in handlers  
- Matching security in OpenAPI  

Typical cases: gateway-injected headers, identities from mTLS, custom signing. For cookie sessions use the [Session strategy](/en/plugins/auth-session-strategy)—do not reimplement it here. If you only need `user` on `ctx` and do not care about Auth conventions, plain middleware works—but you own security and unauthenticated branches.

Below is a **gateway header** (e.g. `x-user-id`) from scratch through mounting on routes.

## Step 1: Decide what identity looks like

Fix the payload after a successful credential check, e.g. `{ userId: number }`. That becomes the strategy’s first generic and the type of `ctx.auth.gateway.data`.

The second generic is `authorize` arguments, e.g. role names: `[string]` → later `.authorize('admin')`.

## Step 2: Implement `authenticate` (collect credentials)

Read credentials from the request; missing or invalid should follow the contract below—**do not throw uncaught errors** (clients often see 500 and assume the service is down).

```typescript
// src/auth/gateway.strategy.ts
import { Strategy, AuthError } from '@aomex/auth';
import type { WebContext } from '@aomex/web';

export class GatewayStrategy extends Strategy<{ userId: number }, [string]> {
  protected async authenticate(ctx: WebContext) {
    const raw = ctx.request.get('x-user-id'); // [!code highlight]
    if (!raw) {
      return false; // → 401 not logged in
    }
    const userId = Number(raw);
    if (!Number.isFinite(userId) || userId <= 0) {
      return new AuthError('invalid gateway user'); // → 401 with message
    }
    return { userId }; // → written to ctx.auth
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
import { GatewayStrategy } from './gateway.strategy';

export const auth = new Auth({
  strategies: {
    gateway: new GatewayStrategy(), // [!code highlight]
  },
});
```

The key `gateway` drives three things:

1. `auth.authenticate('gateway')`  
2. `ctx.auth.gateway`  
3. Shape of `ctx.auth.gateway.data` (from the strategy generic)

## Step 4: Mount and exercise on routes

Split **public** and **protected** routes into separate `Router`s (or `.skip` on the auth chain—see [Middleware](/en/core/middleware)). Do not pile everything in one group and hope auth “just skips.”

```typescript
import { Router } from '@aomex/web';
import { auth } from '@/auth';

export const router = new Router({
  prefix: '/admin',
  mount: [auth.authenticate('gateway')], // whole group requires login
});

router.get('/dashboard', {
  mount: [auth.authenticate('gateway').authorize('admin')], // [!code highlight]
  action: async (ctx) => {
    const userId = ctx.auth.gateway.data.userId;
    ctx.send({ userId });
  },
});
```

You can mount `authenticate` on a single route’s `mount` instead of router-level. Chained `.authorize('admin')` does not change `data` type; the framework returns 403 on failure—you usually do not re-check roles in the action (finer business rules are separate).

Manual checks:

1. No `x-user-id` → **401**  
2. Header present but insufficient role → **403**  
3. Success → `userId` completes in the action  

## Step 5: OpenAPI security

Custom strategies get 401 responses from the base `openapi()` by default. Without a security scheme, Swagger “Authorize” will not match your custom header, and clients generated as Bearer will keep hitting **401**.

Override `openapi()` on the strategy (fields per type hints; compare the Bearer plugin):

```typescript
import type { OpenApiInjector } from '@aomex/web';

protected override openapi(): OpenApiInjector {
  return {
    ...super.openapi(),
    onDocument(document) {
      document.components ||= {};
      document.components.securitySchemes ||= {};
      document.components.securitySchemes['gatewayUser'] ||= {
        type: 'apiKey',
        in: 'header',
        name: 'x-user-id',
      };
    },
    onMethod(methodItem) {
      methodItem.security ||= [];
      methodItem.security.push({ gatewayUser: [] });
    },
  };
}
```

Regenerate OpenAPI and confirm security and 401 descriptions on affected operations.

::: warning
Header names, cookie names, and security metadata must match how you read credentials, or integration will loop on **401**.
:::

## When not to customize

| Situation | Approach |
| --- | --- |
| Standard Bearer / JWT / API Key / Session | Plugin strategies |
| Gateway headers, mTLS, custom signing | Custom `Strategy` (this page) |
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
- Cookie session: [Session strategy](/en/plugins/auth-session-strategy)
- 401 / 403 JSON: [Error format](/en/web/errors)
