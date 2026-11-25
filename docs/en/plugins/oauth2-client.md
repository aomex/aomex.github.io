---
outline: deep
---

# OAuth2 Client

When you need “redirect to their authorize page → bring back a code → exchange for a token” login, the core package is `@aomex/oauth2-client`: **OAuth 2.0 authorization code** (default **PKCE S256**), and with `oidc` it validates `id_token` per OpenID Connect (nonce + JWKS). Login state is still yours to implement (Bearer / Session / JWT, etc.).

For common vendors you don’t need to hand-write endpoints: install the matching `@aomex-contrib/oauth2-*` preset from [aomex-contrib](https://github.com/aomex/aomex-contrib) first; for a self-hosted IdP or anything not on the list, use `new OAuth2Client` directly.

```bash
pnpm add @aomex/oauth2-client
# peers: @aomex/web @aomex/cache @aomex/common
# add a preset when you have one, e.g.: pnpm add @aomex-contrib/oauth2-google
```

## Vendor presets (recommended)

Preset packages fill in authorize / token (or OIDC `issuer`) and default scopes, and narrow return types per vendor. Detailed console setup and field notes live in **each package’s README** (links in the table below).

Organizational tip: **one Service per vendor**—hold the client as `protected` inside the Service, expose only `oauthRedirect` / `oauthCallback`; routes call `services.xxx` only, don’t scatter `new GoogleOAuth2Client` in actions. Matches the scaffold and [Service layer](/en/core/service).

Google (OIDC full-page redirect) as an example:

```typescript
// src/services/google.service.ts
import { Service } from '@aomex/common';
import type { WebContext } from '@aomex/web';
import { GoogleOAuth2Client } from '@aomex-contrib/oauth2-google';
import { cache } from '@/cache';

export default class GoogleService extends Service {
  protected readonly oauth = new GoogleOAuth2Client({ // [!code focus:8]
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: (ctx) => {
      return `${ctx.request.origin}/oauth/google/callback`;
    },
    store: cache, // [!code highlight]
  });

  oauthRedirect(ctx: WebContext) {
    return this.oauth.redirect(ctx);
  }

  oauthCallback(ctx: WebContext) {
    return this.oauth.callback(ctx);
  }
}
```

Register in `combineServices` (factories as `() => import(...)`):

```typescript
export const services = await combineServices({
  google: () => import('@/services/google.service'),
  // github: () => import('@/services/github.service'),
});
```

Routes only call the Service:

```typescript
import { Router } from '@aomex/web';
import { services } from '@/services';

export const router = new Router({ prefix: '/oauth' });

router.get('/google', {
  action: async (ctx) => {
    await services.google.oauthRedirect(ctx); // [!code highlight]
  },
});

router.get('/google/callback', {
  action: async (ctx) => {
    const claims = await services.google.oauthCallback(ctx); // [!code highlight]
    // Without onProfile: verified id_token claims (sub / email …)
    // Write login state here: issue Bearer / write Session …
    ctx.send(claims);
  },
});
```

GitHub and others work the same: another `GithubService` with `GitHubOAuth2Client`; `callback` often returns `{ base, userinfo }` by default. `redirectUri` as `(ctx) => …` builds the callback from the request origin—handy with multiple domains.

`store` temporarily holds `state` (and the PKCE verifier). Construction via `registerLifecycle` auto-`connect`s / `disconnect`s on shutdown. Memory is fine locally; for multi-instance production switch to a Redis adapter (scaffolds often use `CacheRedisAdapter` directly), or the callback may hit another machine and miss state. Default state TTL is `'10 minutes'` (`stateTtl`, `DurationInput`); concurrent callbacks succeed for only one side—failed token exchange does **not** restore state.

For frontend GIS / One Tap that gets a `credential`, don’t use oauth2-google—use `google-identity-login` from the table below (you can wrap that in a Service the same way).

### Preset overview

Packages live in [aomex/aomex-contrib](https://github.com/aomex/aomex-contrib); install like `pnpm add @aomex-contrib/oauth2-google @aomex/oauth2-client`. Click a package name to open its README in the repo.

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
| [`oauth2-spotify`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-spotify) | Spotify (token exchange often uses `tokenAuth: 'basic'`) |
| [`oauth2-wechat`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-wechat) | WeChat Open Platform website QR / Official Account web auth, etc. |
| [`oauth2-wecom`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-wecom) | WeCom (Enterprise WeChat) self-built app web auth |

Flows that are **not** full-page redirect OAuth get separate `*-login` packages—don’t force them into the flow above:

| Package | Notes |
| --- | --- |
| [`google-identity-login`](https://github.com/aomex/aomex-contrib/tree/main/packages/google-identity-login) | Google GIS: verify `credential` / exchange code / fetch userinfo |
| [`wechat-mini-program-login`](https://github.com/aomex/aomex-contrib/tree/main/packages/wechat-mini-program-login) | WeChat Mini Program `code2Session` + phone number (not OAuth) |

When wrapping another vendor yourself, reuse `mergeOAuth2Preset` / `mergeOidcPreset` from [`oauth2-preset`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-preset); business apps generally **don’t** depend on it directly.

## Hand-written OAuth2Client

When it’s not on the list, or you talk to a self-hosted IdP, still put it in a Service: `new OAuth2Client(...)` inside, routes still only call methods like `services.idp.oauthRedirect`.

### Pure OAuth2: hand-written endpoints

Without OIDC discovery you must set `authorizationEndpoint` / `tokenEndpoint` and provide `onProfile`.

```typescript
import { Service } from '@aomex/common';
import type { WebContext } from '@aomex/web';
import { OAuth2Client } from '@aomex/oauth2-client';
import { cache } from '@/cache';

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
    store: cache,
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

Set `oidc.issuer` and it fetches `/.well-known/openid-configuration` to fill endpoints and jwks. If scopes don’t include `openid`, it is added automatically. Without `onProfile`, `callback` returns **verified** claims directly.

```typescript
protected readonly oauth = new OAuth2Client({ // [!code focus:8]
  clientId: process.env.OIDC_CLIENT_ID!,
  clientSecret: process.env.OIDC_CLIENT_SECRET!,
  redirectUri: (ctx) => {
    return `${ctx.request.origin}/oauth/callback`;
  },
  scopes: ['openid', 'email', 'profile'],
  store: cache,
  oidc: { issuer: 'https://accounts.example.com' },
});
```

Write `onProfile` when you need to persist from claims; the argument also includes `oidc.claims`:

```typescript
onProfile: async ({ token, oidc, ctx }) => {
  return upsertUserFromClaims(oidc.claims, token);
},
```

If `id_token` includes `at_hash`, it is checked against this `access_token`; when `aud` is multi-valued, `azp` must equal `client_id`. Override discovery with `oidc.jwksUri` / `expectedIssuer` when needed.

## Refresh and revoke

After login, store `refresh_token` yourself; before expiry call `refresh` on `this.oauth` in the Service. Optional `scope` (narrow only, never widen). On logout or ticket invalidation call `revoke` (needs `revocationEndpoint`; with OIDC and no hand-written URL it tries discovery’s `revocation_endpoint`; pure OAuth2 often needs that URL written by hand).

```typescript
const tokens = await this.oauth.refresh(storedRefreshToken);
await this.oauth.revoke(tokens.access_token, {
  tokenTypeHint: 'access_token',
});
```

Other constructor knobs you’ll touch often: `redirectUri` as a fixed string or `(ctx) => string` from request origin (multi-domain); `clientSecret` can also be `() => string | Promise<string>` (e.g. Apple dynamic JWT); `pkce` defaults to `true` (S256)—turn off only for rare legacy endpoints; token-exchange credentials default to the body—Spotify etc. need `tokenAuth: 'basic'`; `stateTtl` defaults to `'10 minutes'`; extra authorize query params go in `authorizationParams` (won’t override required fields).

::: warning
`callback` only accepts the authorization-code flow (`code` + `state`). If the callback carries implicit / hybrid `id_token` or `token` query params, state is cleared and an error is thrown. When the user cancels, the authorization server often sends `error` (e.g. `access_denied`); after validating and consuming state it throws—decide your own UI copy in the route. Vendors like Apple may use **POST form_post**—follow that preset’s README.
:::

## How it connects to Auth

Neither this package nor the presets are `@aomex/auth` strategies: after you get Profile / claims / `{ base, userinfo }`, you issue your own login credentials. Common pattern: in `oauthCallback` or the route, `upsert` → `auth.strategy('bearer').signature(...)` or write [Session](/en/plugins/auth-session-strategy) → later APIs still go through `authenticate`.

## Related

- Repo and package list: [aomex-contrib](https://github.com/aomex/aomex-contrib)
- Service registration: [Service layer](/en/core/service)
- state / single-flight / TTL: [Cache](/en/core/cache)
- Auth after login: [Auth entry](/en/plugins/auth)
- Cookie login state: [Session strategy](/en/plugins/auth-session-strategy)
- JWT issuing: [JWT strategy](/en/plugins/auth-jwt-strategy)
