---
outline: deep
---

# Bearer strategy

Typical frontend pattern: `Authorization: Bearer <token>`. The server exchanges an opaque token for a user object; failure → **401**. For local verify and fewer DB hits see [JWT strategy](/en/plugins/auth-jwt-strategy)—revocation and permission changes need extra work.

Configure `AuthBearerStrategy`: extract token from the request, resolve identity in `onLoaded`; compare roles in `onAuthorize`; in business code read `ctx.auth.bearer.data`, not the raw token string.

## Install

Bearer ships with `@aomex/auth` main package—import from subpath.

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

Issue token on login (no authenticate):

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

`signature` produces an **opaque** random string (optional business key for isolation)—**not** a JWT. Login routes must not mount `authenticate`.

After success:

```typescript
ctx.auth.bearer // { token: string; data: T }
```

`T` is what `onLoaded` returns. `authorize('bearer', n)` types follow your `onAuthorize`.

`onAuthorize` may be an instance method (`this.getIdentity()`) or curried—pick one; types follow the strategy definition:

```typescript
onAuthorize: (minRole: number) => {
  return (identity) => {
    return identity.role >= minRole;
  };
},
```

## tokenLoaders and onLoaded

| Option | When to use | Default |
| --- | --- | --- |
| `onLoaded` | Redis/DB lookup; `false` when missing | **required** |
| `tokenLoaders` | Default reads `Authorization`; cookie/query for embed pages | header Bearer (preferred; query/body leak to logs/Referer) |
| `onAuthorize` | When using `authorize(role)`; omit if login-only | optional |

`tokenLoaders` shapes:

- `{ type: 'header', key: 'authorization' }` — `Bearer <token>` two-part only
- `{ type: 'body' | 'query' | 'cookie', key: 'access_token' }` — when headers impossible

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

For OpenAPI, pass the same `WebApp` with `auth.authenticate('bearer')` to `generateOpenapi({ app })`. Overview: [Authentication](/en/plugins/auth).

`onLoaded` returning `false` means unauthenticated (**401**)—do not substitute business exceptions unless you want custom codes. Self-contained JWT: [JWT strategy](/en/plugins/auth-jwt-strategy)—do not verify JWT as opaque Bearer.

## Related

- [Authentication](/en/plugins/auth)
- [JWT strategy](/en/plugins/auth-jwt-strategy)
- [OpenAPI generation](/en/plugins/openapi)