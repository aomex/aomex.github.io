---
outline: deep
---

# API Key strategy

Give scripts, partners, or internal services a “bring a key and call” path. AuthApiKeyStrategy reads a **bare** secret from a header (or query/cookie you configure) and maps it to an application identity—**not** the two-part Bearer form. For end-user login, use [Bearer](/en/plugins/auth-bearer-strategy) or [JWT](/en/plugins/auth-jwt-strategy).

Validate `x-api-key` (or a custom header); after success, business code uses `ctx.auth.apiKey`. An open platform can split from the user-login domain with two Router prefixes.

## Install

Shares the `@aomex/auth` main package with Bearer.

```bash
pnpm add @aomex/auth
```

```typescript
import { AuthApiKeyStrategy } from '@aomex/auth/api-key';
```

## Open-platform Router

```typescript
import { Auth } from '@aomex/auth';
import { AuthApiKeyStrategy } from '@aomex/auth/api-key';
import { Router } from '@aomex/web';

const auth = new Auth({
  strategies: {
    apiKey: new AuthApiKeyStrategy({
      onLoaded: async (key) => {
        const app = await clients.verify(key);
        if (!app) {
          return false;
        }
        return { appId: app.id, scopes: app.scopes };
      },
    }),
  },
});

const openApi = new Router({
  prefix: '/open',
  mount: [auth.authenticate('apiKey')], // [!code highlight]
});

openApi.get('/usage', {
  action: async (ctx) => {
    ctx.send({ appId: ctx.auth.apiKey.data.appId });
  },
});
```

To coexist with user Bearer, keep strategy names separate and mount them on different Routers.

After success:

```typescript
ctx.auth.apiKey // { key: string; data: T }
```

Extra argument types for `authorize('apiKey', …)` come from your `onAuthorize`, same as Bearer. Without `onAuthorize`, you usually only check “is there a valid key”.

## Multiple key sources and rate-limit dimension

`onLoaded` is required: validate the key and return an application identity. By default only the `x-api-key` header is accepted; write `keyLoaders` when you want ordered tries across header / query / cookie. Add `onAuthorize` when you also gate by scope or plan.

Supported loaders: header (bare header value; key name matched lowercased), query (use carefully—easy to log), cookie. **Reading the key from the body is not supported**, so secrets do not land in request-body logs. Prefer header in production.

```typescript
new AuthApiKeyStrategy({
  keyLoaders: [ // [!code highlight]
    { type: 'header', key: 'x-api-key' },
    { type: 'query', key: 'api_key' },
  ],
  onLoaded: async (key) => {
    return lookup(key);
  },
});
```


`signature()` can generate a random key string (when issuing a new client), similar to the Bearer strategy.

Paired with [@aomex/rate-limit](/en/plugins/rate-limit), you can quota by key—usually ensure auth finished before rate limiting, or read the key from the header yourself:

```typescript
rateLimit({
  id: (ctx) => { // [!code highlight]
    return ctx.auth.apiKey?.key ?? ctx.request.ip;
  },
});
```

OpenAPI injects an apiKey scheme; `in` / `name` usually come from the **first** keyLoader.

::: warning
A leaked key is leaked authority: store hashes, support rotation, and do not leave plaintext sitting in the DB for long. An API Key is not a substitute for end-user login—consumer products still use Bearer/JWT.
:::

Do not mix user sessions and API Keys on the same route group: a dedicated open-platform prefix plus `authenticate('apiKey')` stays clearer.

## Related

- [Authentication](/en/plugins/auth)
- [Bearer strategy](/en/plugins/auth-bearer-strategy)
- [Rate limit](/en/plugins/rate-limit)
