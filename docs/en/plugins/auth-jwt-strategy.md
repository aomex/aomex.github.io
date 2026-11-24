---
outline: deep
---

# JWT strategy

When you use “self-contained” tokens: the gateway or service verifies the signature locally and rarely hits Redis. Revocation usually relies on short TTL, refresh tokens, or a blacklist; do not put passwords in the payload. If you need the server to invalidate any session at any time, [Bearer + stored session](/en/plugins/auth-bearer-strategy) is often smoother.

Install `@aomex/auth-jwt-strategy`, configure the secret and `onVerified`; mount `authenticate('jwt')` on the Router, and read `ctx.auth.jwt` in business code (that is the return value of `onVerified`, not a `{ token, data }` shape).

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

Issue a token in the login or refresh action:

```typescript
const token = auth.strategy('jwt').signature(
  { sub: user.id, roles: user.roles },
  { expiresIn: '7d' },
);
```

## ctx.auth shape vs Bearer

| Strategy | Rough shape of `ctx.auth[name]` |
| --- | --- |
| Bearer | `{ token, data }` |
| JWT | The object returned by `onVerified` itself |

So JWT routes commonly use `ctx.auth.jwt.userId`, not `ctx.auth.jwt.data.userId`. Do not mix Bearer’s `ctx.auth` shape—when you migrate strategies, update how business code reads identity.

The argument types of `authorize('jwt', level)` follow your `onAuthorize` definition.

::: warning
Do not put passwords or other sensitive fields in the JWT payload: the claims can be decoded and read. Put only identifiers and roles.
:::

## Tighten verification and revocation

In production, pin algorithm and audience so unexpected algorithms are rejected. In `onVerified`, check a blacklist: return `false` on a hit → **401**. The token is taken from `Authorization` Bearer by default; add cookie/query via `tokenLoaders` when you need Bearer-like sources.

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

Role gates on admin APIs still go through `onAuthorize`, using `this.getIdentity()` on the instance. For asymmetric keys, old-key rotation, and other advanced setups, see [Advanced: custom auth strategy](/en/advanced/auth-strategy).

When verification fails, check whether server clocks are in sync first. There is no silver bullet for revocation: short `expiresIn` plus a refresh endpoint is a common combo; blacklists are yours to maintain.

## Related

- [Authentication](/en/plugins/auth)
- [Bearer strategy](/en/plugins/auth-bearer-strategy)
- [Generate OpenAPI](/en/openapi/)
