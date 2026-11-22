---
outline: deep
---

# OAuth2 客戶端

要對接「跳到對方授權頁 → 帶回 code → 換 token」的登入時，核心包是 `@aomex/oauth2-client`：**OAuth 2.0 授權碼**（預設 **PKCE S256**），配上 `oidc` 後按 OpenID Connect 校驗 `id_token`（nonce + JWKS）。登入態仍由你自己寫（Bearer / Session / JWT 等）。

常見廠商不必手寫端點：先裝 [aomex-contrib](https://github.com/aomex/aomex-contrib) 裡對應的 `@aomex-contrib/oauth2-*` 預設；自建 IdP 或列表裡沒有的，再直接 `new OAuth2Client`。

```bash
pnpm add @aomex/oauth2-client
# peer：@aomex/web @aomex/cache @aomex/common
# 有预设时再加，例如：pnpm add @aomex-contrib/oauth2-google
```

## 廠商預設（推薦）

預設包填好 authorize / token（或 OIDC `issuer`）與預設 scope，返回型別也按廠商收窄。詳細後臺配置、欄位說明寫在**各包 README**（連結見下表）。

組織上建議：**一廠商一個 Service**——在 Service 裡 `protected` 持有客戶端，對外只暴露 `oauthRedirect` / `oauthCallback`；路由只調 `services.xxx`，別在 action 裡散落 `new GoogleOAuth2Client`。與腳手架、[服務層](/zh-TW/core/service) 一致。

以 Google（OIDC 整頁 redirect）為例：

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

註冊進 `combineServices`（工廠寫成 `() => import(...)`）：

```typescript
export const services = await combineServices({
  google: () => import('./google.service.js'),
  // github: () => import('./github.service.js'),
});
```

路由裡只調 Service：

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
    // 省略 onProfile 时：已验签的 id_token claims（sub / email …）
    // 在此写登录态：签发 Bearer / 写 Session …
    ctx.send(claims);
  },
});
```

GitHub 等同理：另建 `GithubService`，裡面換 `GitHubOAuth2Client`；`callback` 預設多是 `{ base, userinfo }`。`redirectUri` 用 `(ctx) => …` 可按請求 origin 拼回調，多域名省事。

`store` 暫存 `state`（及 PKCE verifier）。構造時經 `registerLifecycle` 自動 `connect` / 關停 `disconnect`。本地可用 memory；生產多實例換 Redis 適配器（腳手架常直接用 `CacheRedisAdapter`），否則回調可能打到另一臺、找不到 state。state 預設 TTL `'10 minutes'`（`stateTtl`，`DurationInput`）；併發 callback 只有一方成功，換票失敗**不會**恢復 state。

前端 GIS / One Tap 拿 `credential` 的，不要用 oauth2-google，改用下表裡的 `google-identity-login`（也可同樣收成一個 Service）。

### 預設一覽

包在 [aomex/aomex-contrib](https://github.com/aomex/aomex-contrib)；安裝形如 `pnpm add @aomex-contrib/oauth2-google @aomex/oauth2-client`。點包名進倉庫看 README。

| 包 | 說明 |
| --- | --- |
| [`oauth2-google`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-google) | Google OIDC（整頁 redirect） |
| [`oauth2-microsoft`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-microsoft) | Microsoft / Entra ID OIDC |
| [`oauth2-apple`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-apple) | Sign in with Apple（`form_post` + JWT `client_secret`） |
| [`oauth2-github`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-github) | GitHub OAuth App |
| [`oauth2-discord`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-discord) | Discord |
| [`oauth2-gitlab`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-gitlab) | GitLab.com |
| [`oauth2-linkedin`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-linkedin) | LinkedIn |
| [`oauth2-facebook`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-facebook) | Facebook Login |
| [`oauth2-twitter`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-twitter) | Twitter（X） |
| [`oauth2-spotify`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-spotify) | Spotify（換票常用 `tokenAuth: 'basic'`） |
| [`oauth2-wechat`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-wechat) | 微信開放平臺網站掃碼 / 公眾號網頁授權等 |
| [`oauth2-wecom`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-wecom) | 企業微信自建應用網頁授權 |

**不是**整頁 redirect OAuth 的，單獨開了 `*-login` 包，別塞進上表流程：

| 包 | 說明 |
| --- | --- |
| [`google-identity-login`](https://github.com/aomex/aomex-contrib/tree/main/packages/google-identity-login) | Google GIS：校驗 `credential` / 換 code / 拉 userinfo |
| [`wechat-mini-program-login`](https://github.com/aomex/aomex-contrib/tree/main/packages/wechat-mini-program-login) | 微信小程式 `code2Session` + 手機號（非 OAuth） |

自研又一個廠商薄封裝時，可複用 [`oauth2-preset`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-preset) 的 `mergeOAuth2Preset` / `mergeOidcPreset`；業務應用一般**不用**直接依賴它。

## 手寫 OAuth2Client

列表裡沒有、或要對接自建 IdP 時，同樣收進 Service：裡面 `new OAuth2Client(...)`，路由仍只調 `services.idp.oauthRedirect` 這類方法。

### 純 OAuth2：手寫端點

沒有 OIDC discovery 時，必須填 `authorizationEndpoint` / `tokenEndpoint`，並提供 `onProfile`。

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

### OIDC：discovery + 驗 id_token

配 `oidc.issuer`，會請求 `/.well-known/openid-configuration` 補齊端點與 jwks。scope 裡若沒寫 `openid` 會自動補上。省略 `onProfile` 時，`callback` 直接返回**已驗籤** claims。

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

需要按 claims 落庫時再寫 `onProfile`，入參多一個 `oidc.claims`：

```typescript
onProfile: async ({ token, oidc, ctx }) => {
  return upsertUserFromClaims(oidc.claims, token);
},
```

`id_token` 裡若帶 `at_hash`，會與本次 `access_token` 校驗；`aud` 為多值時還要求 `azp` 等於 `client_id`。可用 `oidc.jwksUri` / `expectedIssuer` 覆蓋 discovery。

## 重新整理與吊銷

登入後業務自己存 `refresh_token`；過期前在 Service 裡對 `this.oauth` 調 `refresh`。可選 `scope`（只能縮小，不能擴大）。退出或廢票時調 `revoke`（需配置 `revocationEndpoint`；OIDC 未手寫時會嘗試 discovery 的 `revocation_endpoint`）。

```typescript
const tokens = await this.oauth.refresh(storedRefreshToken);
await this.oauth.revoke(tokens.access_token, {
  tokenTypeHint: 'access_token',
});
```

## 常改選項

| 選項 | 幹什麼 |
| --- | --- |
| `redirectUri` | 固定字串，或 `(ctx) => string` 按請求拼（多域名） |
| `clientSecret` | 字串，或 `() => string \| Promise<string>`（如 Apple 動態 JWT） |
| `pkce` | 預設 `true`（S256）；極少數舊端點可關 |
| `tokenAuth` | 換票時憑證放哪：`body`（預設）或 `basic` |
| `stateTtl` | state 快取多久，預設 `'10 minutes'` |
| `authorizationParams` | 額外塞進授權 URL 的 query（不覆蓋必要欄位） |
| `revocationEndpoint` | 吊銷 URL；純 OAuth2 常需手寫 |

::: warning
`callback` 只接受授權碼流（`code` + `state`）。回調裡若帶隱式 / 混合流的 `id_token` 或 `token` query，會清掉 state 並拋錯。使用者取消授權時授權伺服器常帶 `error`（如 `access_denied`），校驗並消費 state 後拋錯——路由裡自行決定提示文案。Apple 等廠商可能是 **POST form_post**，以對應預設 README 為準。
:::

## 和 Auth 怎麼接

本包與預設**都不是** `@aomex/auth` 策略：產出 Profile / claims / `{ base, userinfo }` 後，你再簽發自己的登入憑證。常見接法：在 `oauthCallback` 或路由裡 `upsert` → `auth.strategy('bearer').signature(...)` 或寫 [Session](/zh-TW/plugins/auth-session-strategy) → 之後介面仍走 `authenticate`。

## 相關

- 倉庫與包列表：[aomex-contrib](https://github.com/aomex/aomex-contrib)
- 服務註冊：[服務層](/zh-TW/core/service)
- state / 單飛 / 時長：[快取](/zh-TW/core/cache)
- 登入後鑑權：[統一入口 Auth](/zh-TW/plugins/auth)
- Cookie 登入態：[Session 策略](/zh-TW/plugins/auth-session-strategy)
- JWT 簽發：[JWT 策略](/zh-TW/plugins/auth-jwt-strategy)
