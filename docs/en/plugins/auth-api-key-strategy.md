---
outline: deep
---

# API Key strategy

A “bring the key, call the API” channel for scripts, partners, or internal services. `AuthApiKeyStrategy` reads a **raw** key from headers (or configured query/cookie) and maps to app identity—not Bearer’s two-part form. End-user login: [Bearer](/en/plugins/auth-bearer-strategy) or [JWT](/en/plugins/auth-jwt-strategy).

Validate `x-api-key` (or custom header); after success use `ctx.auth.apiKey`; open platforms often use a separate Router prefix from user login.

## Install

Shares `@aomex/auth` with Bearer.

```bash
pnpm add @aomex/auth
```

```typescript
import { AuthApiKeyStrategy } from '@aomex/auth/api-key';
```

## Open platform Router

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

Coexist with user Bearer—different strategy names on different Routers.

After success:

```typescript
ctx.auth.apiKey // { key: string; data: T }
```

Extra `authorize('apiKey', …)` args follow your `onAuthorize` like Bearer. Without `onAuthorize`, usually only “valid key exists”.

## keyLoaders and rate-limit dimension

| Option | When to use | Default |
| --- | --- | --- |
| `keyLoaders` | Try header / query / cookie in order | `[{ type: 'header', key: 'x-api-key' }]` |
| `onLoaded` | Validate key, return app identity | **required** |
| `onAuthorize` | Scopes, plan tier, etc. | optional |

Loaders:

- `header` — raw header value (key name lowercased)
- `query` — caution, lands in logs
- `cookie` — team convention

**No body loader**—avoids keys in body logs. Prefer header in production.

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

`signature()` can generate random keys when issuing clients—similar to Bearer.

With [@aomex/rate-limit](/en/plugins/rate-limit), quota by key—usually authenticate first or read header yourself:

```typescript
rateLimit({
  id: (ctx) => { // [!code highlight]
    return ctx.auth.apiKey?.key ?? ctx.request.ip;
  },
});
```

OpenAPI injects `apiKey` scheme; `in` / `name` generally from the **first** `keyLoader`.

::: warning
Leaked key = leaked permission: store hashes, support rotation, no long-lived plaintext in DB. API Key is not a consumer login replacement—use Bearer/JWT for end users.
:::

Do not mix user sessions and API keys in one route group—separate prefix + `authenticate('apiKey')` is clearer.

## Related

- [Authentication](/en/plugins/auth)
- [Bearer strategy](/en/plugins/auth-bearer-strategy)
- [Rate limiting](/en/plugins/rate-limit)