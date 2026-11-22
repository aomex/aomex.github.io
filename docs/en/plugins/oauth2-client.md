---
outline: deep
---

# OAuth2 client

For「redirect to the provider → come back with a code → exchange for tokens」, the core package is `@aomex/oauth2-client`: **OAuth 2.0 authorization code** (**PKCE S256** by default); with `oidc` it verifies `id_token` as OpenID Connect (nonce + JWKS). You still own the login session (Bearer / Session / JWT, …).

For common vendors you do not need to hand-write endpoints: install the matching `@aomex-contrib/oauth2-*` preset from [aomex-contrib](https://github.com/aomex/aomex-contrib). For your own IdP or vendors not in the list, construct `OAuth2Client` directly.

```bash
pnpm add @aomex/oauth2-client
# peers: @aomex/web @aomex/cache @aomex/common
# when a preset exists, e.g.: pnpm add @aomex-contrib/oauth2-google
```

## Vendor presets (preferred)

Presets fill authorize / token (or OIDC `issuer`) and default scopes, and narrow return types per vendor. Admin-console setup and field notes live in **each package README** (links below).

Organization: **one Service per vendor**—hold the client as `protected` on the Service, expose only `oauthRedirect` / `oauthCallback`; routes call `services.xxx` and do not scatter `new GoogleOAuth2Client` in actions. Same shape as the scaffold and the [service layer](/en/core/service).

Google (OIDC full-page redirect) example:

```typescript
// src/services/google.service.ts
import { Service } from '@aomex/common';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import type { WebContext } from '@aomex/web';
import { GoogleOAuth2Client } from '@aomex-contrib/oauth2-google';

export default class GoogleService extends Service {
  protected readonly oauth = new GoogleOAuth2Client({ // [!code focus:8]
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: (ctx) => {
      return `${ctx.request.origin}/oauth/google/callback`;
    },
    store: new CacheMemoryAdapter(),
  });

  oauthRedirect(ctx: WebContext) {
    return this.oauth.redirect(ctx);
  }

  oauthCallback(ctx: WebContext) {
    return this.oauth.callback(ctx);
  }
}
```

Register with `combineServices` (factory as `() => import(...)`):

```typescript
export const services = await combineServices({
  google: () => import('./google.service.js'),
  // github: () => import('./github.service.js'),
});
```

Routes only call the Service:

```typescript
import { Router } from '@aomex/web';
import { services } from '../services/index.js';

export const router = new Router({ prefix: '/oauth' });

router.get('/google', {
  action: async (ctx) => {
    await services.google.oauthRedirect(ctx); // [!code highlight]
  },
});

router.get('/google/callback', {
  action: async (ctx) => {
    const claims = await services.google.oauthCallback(ctx); // [!code highlight]
    // without onProfile: verified id_token claims (sub / email …)
    // issue your login session: Bearer / Session / …
    ctx.send(claims);
  },
});
```

GitHub is the same idea: another `GithubService` with `GitHubOAuth2Client`; `callback` often returns `{ base, userinfo }`. A function `redirectUri` can build the callback from `ctx.request.origin` across hosts.

`store` holds `state` (and the PKCE verifier). Construction registers lifecycle so the adapter `connect`s / `disconnect`s automatically. Memory is fine locally; in multi-instance production use a Redis adapter (the scaffold often uses `CacheRedisAdapter` directly) or the callback may miss state. Default state TTL is `'10 minutes'` (`stateTtl`, `DurationInput`). Concurrent callbacks succeed for only one side; a failed exchange does **not** restore state.

For GIS / One Tap `credential` on the frontend, do **not** use oauth2-google—use `google-identity-login` below (also fine as its own Service).

### Preset catalog

Packages live in [aomex/aomex-contrib](https://github.com/aomex/aomex-contrib); install like `pnpm add @aomex-contrib/oauth2-google @aomex/oauth2-client`. Open the package name for its README.

| Package | Notes |
| --- | --- |
| [`oauth2-google`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-google) | Google OIDC (full-page redirect) |
| [`oauth2-microsoft`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-microsoft) | Microsoft / Entra ID OIDC |
| [`oauth2-apple`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-apple) | Sign in with Apple (`form_post` + JWT `client_secret`) |
| [`oauth2-github`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-github) | GitHub OAuth App |
| [`oauth2-discord`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-discord) | Discord |
| [`oauth2-gitlab`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-gitlab) | GitLab.com |
| [`oauth2-linkedin`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-linkedin) | LinkedIn |
| [`oauth2-facebook`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-facebook) | Facebook Login |
| [`oauth2-twitter`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-twitter) | Twitter (X) |
| [`oauth2-spotify`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-spotify) | Spotify (often `tokenAuth: 'basic'`) |
| [`oauth2-wechat`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-wechat) | WeChat Open Platform / Official Account web OAuth |
| [`oauth2-wecom`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-wecom) | WeCom (Work WeChat) self-built app web auth |

**Not** full-page redirect OAuth—separate `*-login` packages:

| Package | Notes |
| --- | --- |
| [`google-identity-login`](https://github.com/aomex/aomex-contrib/tree/main/packages/google-identity-login) | Google GIS: verify `credential` / exchange code / userinfo |
| [`wechat-mini-program-login`](https://github.com/aomex/aomex-contrib/tree/main/packages/wechat-mini-program-login) | WeChat mini program `code2Session` + phone (not OAuth) |

When building another thin vendor wrapper, reuse [`oauth2-preset`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-preset) (`mergeOAuth2Preset` / `mergeOidcPreset`). Apps usually **should not** depend on it directly.

## Hand-written `OAuth2Client`

When the vendor is missing or you talk to your own IdP, still put it in a Service: `new OAuth2Client(...)` inside, routes only call methods like `services.idp.oauthRedirect`.

### Plain OAuth2: hand-written endpoints

Without OIDC discovery you must set `authorizationEndpoint` / `tokenEndpoint` and provide `onProfile`.

```typescript
import { Service } from '@aomex/common';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import type { WebContext } from '@aomex/web';
import { OAuth2Client } from '@aomex/oauth2-client';

export default class IdpService extends Service {
  protected readonly oauth = new OAuth2Client({ // [!code focus:14]
    authorizationEndpoint: 'https://idp.example.com/oauth/authorize',
    tokenEndpoint: 'https://idp.example.com/oauth/token',
    clientId: process.env.IDP_CLIENT_ID!,
    clientSecret: process.env.IDP_CLIENT_SECRET!,
    redirectUri: (ctx) => {
      return `${ctx.request.origin}/oauth/callback`;
    },
    scopes: ['profile'],
    store: new CacheMemoryAdapter(),
    onProfile: async ({ token }) => {
      const res = await fetch('https://idp.example.com/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      return res.json();
    },
  });

  oauthRedirect(ctx: WebContext) {
    return this.oauth.redirect(ctx);
  }

  oauthCallback(ctx: WebContext) {
    return this.oauth.callback(ctx);
  }
}
```

### OIDC: discovery + id_token verification

Set `oidc.issuer` to load `/.well-known/openid-configuration`. Missing `openid` in scopes is added automatically. Omit `onProfile` and `callback` returns **verified** claims.

```typescript
protected readonly oauth = new OAuth2Client({ // [!code focus:8]
  clientId: process.env.OIDC_CLIENT_ID!,
  clientSecret: process.env.OIDC_CLIENT_SECRET!,
  redirectUri: (ctx) => {
    return `${ctx.request.origin}/oauth/callback`;
  },
  scopes: ['openid', 'email', 'profile'],
  store: new CacheMemoryAdapter(),
  oidc: { issuer: 'https://accounts.example.com' },
});
```

Map claims into a business user with `onProfile` (args include `oidc.claims`):

```typescript
onProfile: async ({ token, oidc, ctx }) => {
  return upsertUserFromClaims(oidc.claims, token);
},
```

If `id_token` carries `at_hash`, it is checked against this `access_token`; with a multi-valued `aud`, `azp` must equal `client_id`. Override discovery with `oidc.jwksUri` / `expectedIssuer` when needed.

## Refresh and revoke

Persist `refresh_token` yourself; call `refresh` on `this.oauth` inside the Service before expiry. Optional `scope` may only shrink. On logout or invalidation call `revoke` (needs `revocationEndpoint`; for OIDC, discovery’s `revocation_endpoint` is used when unset).

```typescript
const tokens = await this.oauth.refresh(storedRefreshToken);
await this.oauth.revoke(tokens.access_token, {
  tokenTypeHint: 'access_token',
});
```

## Options you usually change

| Option | Role |
| --- | --- |
| `redirectUri` | Fixed string, or `(ctx) => string` per request (multi-host) |
| `clientSecret` | String, or `() => string \| Promise<string>` (e.g. Apple JWT) |
| `pkce` | Default `true` (S256); turn off only for rare legacy endpoints |
| `tokenAuth` | Where credentials go on exchange: `body` (default) or `basic` |
| `stateTtl` | How long state lives; default `'10 minutes'` |
| `authorizationParams` | Extra authorize URL query (does not override required fields) |
| `revocationEndpoint` | Revoke URL; often required for plain OAuth2 |

::: warning
`callback` only accepts the authorization-code flow (`code` + `state`). Implicit / hybrid `id_token` or `token` query values clear state and throw. When the user cancels, providers often return `error` (e.g. `access_denied`); state is validated and consumed, then an error is thrown—handle copy in the route. Some vendors (Apple) use **POST form_post**—follow that preset’s README.
:::

## Wiring to Auth

Neither the core package nor presets are `@aomex/auth` strategies: they yield Profile / claims / `{ base, userinfo }`; you then issue your own credentials. Typical path: `upsert` in `oauthCallback` or the route → `auth.strategy('bearer').signature(...)` or write a [Session](/en/plugins/auth-session-strategy) → later routes still use `authenticate`.

## Related

- Repo and package list: [aomex-contrib](https://github.com/aomex/aomex-contrib)
- Service registration: [Service layer](/en/core/service)
- State / single-flight / durations: [Cache](/en/core/cache)
- Auth after login: [Auth entry](/en/plugins/auth)
- Cookie sessions: [Session strategy](/en/plugins/auth-session-strategy)
- JWT issuance: [JWT strategy](/en/plugins/auth-jwt-strategy)
