---
outline: deep
---

# JWT strategy

When using self-contained tokens: verify locally at gateway or service, fewer Redis lookups. Revocation usually means short TTL, refresh tokens, or blocklists—do not put passwords in payload. To revoke any session server-side anytime, [Bearer + session store](/en/plugins/auth-bearer-strategy) is often simpler.

Install `@aomex/auth-jwt-strategy`, configure secret and `onVerified`; mount `authenticate('jwt')` on Router; business reads `ctx.auth.jwt` (the `onVerified` return value—not `{ token, data }`).

## Install

```bash
pnpm add @aomex/auth
pnpm add @aomex/auth-jwt-strategy
```

## secret and onVerified

```typescript
import { Auth } from '@aomex/auth';
import { AuthJwtStrategy } from '@aomex/auth-jwt-strategy';
import { Router } from '@aomex/web';

const auth = new Auth({
  strategies: {
    jwt: new AuthJwtStrategy({
      secret: process.env.JWT_SECRET!,
      onVerified: (payload) => { // [!code highlight]
        return {
          userId: String(payload.sub),
          roles: (payload.roles as string[]) ?? [],
        };
      },
      onAuthorize(level: number) {
        const identity = this.getIdentity();
        return identity.roles.includes('admin') || level <= 1;
      },
    }),
  },
});

export const router = new Router({
  mount: [auth.authenticate('jwt')],
});

router.get('/me', {
  mount: [auth.authorize('jwt', 1)],
  action: async (ctx) => {
    ctx.send({ userId: ctx.auth.jwt.userId });
  },
});
```

Sign on login or refresh in the action:

```typescript
const token = auth.strategy('jwt').signature(
  { sub: user.id, roles: user.roles },
  { expiresIn: '7d' },
);
```

## ctx.auth shape vs Bearer

| Strategy | Rough `ctx.auth[name]` shape |
| --- | --- |
| Bearer | `{ token, data }` |
| JWT | `onVerified` return object itself |

JWT routes use `ctx.auth.jwt.userId`, not `ctx.auth.jwt.data.userId`. Mind the difference when migrating strategies.

`authorize('jwt', level)` args follow `onAuthorize`.

::: warning
Do not put passwords or secrets in JWT payload—claims are readable; identifiers and roles only.
:::

## verifyOptions and revocation

| Option | When to use |
| --- | --- |
| `secret` | Symmetric key; common for monolith / internal |
| `tokenLoaders` | Default `Authorization` Bearer; add cookie/query like Bearer |
| `verifyOptions` | Tighten algorithms, `audience` / `issuer` |
| `onVerified` | Map payload to identity; blocklist hit → `false` → 401 |
| `onAuthorize` | Admin routes by role; instance methods use `this.getIdentity()` |

```typescript
new AuthJwtStrategy({
  secret: process.env.JWT_SECRET!,
  verifyOptions: { algorithms: ['HS256'], audience: 'api' }, // [!code highlight]
  onVerified: (payload) => {
    if (isRevoked(payload.jti)) {
      return false;
    }
    return {
      userId: String(payload.sub),
      roles: (payload.roles as string[]) ?? [],
    };
  },
});
```

Asymmetric keys and rotation: [Advanced: custom auth strategies](/en/advanced/auth-strategy).

On verify failure check server clock skew. No silver bullet for revocation—short `expiresIn` + refresh is common; blocklists are DIY.

## Related

- [Authentication](/en/plugins/auth)
- [Bearer strategy](/en/plugins/auth-bearer-strategy)
- [Generate OpenAPI](/en/openapi/)