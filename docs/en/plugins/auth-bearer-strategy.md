---
outline: deep
---

# Bearer strategy

The most common frontend pattern is `Authorization: Bearer <token>`. The server exchanges an opaque token for a user object; failure → **401**. For local signature checks with fewer DB hits, see [JWT strategy](/en/plugins/auth-jwt-strategy)—but revocation and permission changes usually need extra work.

Configure AuthBearerStrategy: pull the token from the request, map it to a business identity in `onLoaded`; compare roles in `onAuthorize` when needed; read `ctx.auth.bearer.data` in business code, not the raw token string.

## Install

Bearer ships with the `@aomex/auth` main package—import from the subpath.

```bash
pnpm add @aomex/auth
```

```typescript
import { AuthBearerStrategy } from '@aomex/auth/bearer';
```

## onLoaded and Router mount

```typescript
import { Auth } from '@aomex/auth';
import { AuthBearerStrategy } from '@aomex/auth/bearer';
import { Router } from '@aomex/web';

const auth = new Auth({
  strategies: {
    bearer: new AuthBearerStrategy({
      onLoaded: async (token, ctx) => {
        const row = await db.tokens.find(token);
        if (!row) {
          return false;
        }
        return { userId: row.userId, role: row.role };
      },
      onAuthorize(minRole: number) {
        return this.getIdentity().role >= minRole;
      },
    }),
  },
});

const router = new Router({ // [!code focus:10]
  mount: [auth.authenticate('bearer')], // [!code highlight]
});

router.get('/me', {
  action: async (ctx) => {
    ctx.send(ctx.auth.bearer.data);
  },
});

router.delete('/posts/:id', {
  mount: [auth.authenticate('bearer').authorize(10)],
  action: async (ctx) => {
    ctx.send(204, null);
  },
});
```

Issue a token in the login route (do **not** mount authenticate):

```typescript
router.post('/login', { // [!code focus:13]
  mount: [body({ email: rule.email(), password: rule.string() })],
  action: async (ctx) => {
    const user = await verifyPassword(ctx.body);
    if (!user) {
      return ctx.throw(401, 'invalid credentials');
    }

    const token = auth.strategy('bearer').signature('sha256', user.id); // [!code highlight]
    await saveSession(token, { userId: user.id, role: user.role });
    ctx.send({ token });
  },
});
```

`signature` produces an **opaque** random string (you can mix in a business key for domain isolation)—**not** a JWT. Do not mount authenticate on the login route itself.

After successful auth:

```typescript
ctx.auth.bearer // { token: string; data: T }
```

`T` is the object shape `onLoaded` returns on success. The type of `n` in `authorize('bearer', n)` follows your `onAuthorize`.

`onAuthorize` can be an instance method (use `this.getIdentity()`) or curried—pick one; types follow the strategy definition:

```typescript
onAuthorize: (minRole: number) => {
  return (identity) => {
    return identity.role >= minRole;
  };
},
```

## Loading the token from multiple sources

`onLoaded` is required: look up Redis/DB to turn the token into a user; return `false` when missing → **401**. By default only `Authorization` Bearer is read (preferred in production); for embeds that cannot send headers, add query / cookie / body—query and body often leak into access logs and Referer, so avoid them when you can. When you only need a logged-in state and not role gates, `onAuthorize` can be omitted.

Common `tokenLoaders` shapes:

- `{ type: 'header', key: 'authorization' }` — only the two-part `Bearer <token>` form; bare tokens do not belong here
- `{ type: 'body' | 'query' | 'cookie', key: 'access_token' }` — fallback when headers are unavailable

```typescript
new AuthBearerStrategy({
  tokenLoaders: [ // [!code highlight]
    { type: 'header', key: 'authorization' },
    { type: 'query', key: 'access_token' },
  ],
  onLoaded: async (token) => {
    const session = await cache.getSession(token);
    return session || false;
  },
});
```

When generating OpenAPI, pass the same `WebApp` that mounts `auth.authenticate('bearer')` to `generateOpenapi({ app })` so the Bearer security scheme appears in the docs. See [Authentication](/en/plugins/auth) for the overview.

`onLoaded` returning `false` means unauthenticated—do not substitute a business exception unless you need a custom error code. Self-contained JWTs belong on [JWT strategy](/en/plugins/auth-jwt-strategy); do not verify a JWT as an opaque Bearer string.

## Related

- [Authentication](/en/plugins/auth)
- [JWT strategy](/en/plugins/auth-jwt-strategy)
- [Generate OpenAPI](/en/openapi/)
