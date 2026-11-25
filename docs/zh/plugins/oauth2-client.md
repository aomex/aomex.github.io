---
outline: deep
---

# OAuth2 客户端

要对接「跳到对方授权页 → 带回 code → 换 token」的登录时，核心包是 `@aomex/oauth2-client`：**OAuth 2.0 授权码**（默认 **PKCE S256**），配上 `oidc` 后按 OpenID Connect 校验 `id_token`（nonce + JWKS）。登录态仍由你自己写（Bearer / Session / JWT 等）。

常见厂商不必手写端点：先装 [aomex-contrib](https://github.com/aomex/aomex-contrib) 里对应的 `@aomex-contrib/oauth2-*` 预设；自建 IdP 或列表里没有的，再直接 `new OAuth2Client`。

```bash
pnpm add @aomex/oauth2-client
# peer：@aomex/web @aomex/cache @aomex/common
# 有预设时再加，例如：pnpm add @aomex-contrib/oauth2-google
```

## 厂商预设（推荐）

预设包填好 authorize / token（或 OIDC `issuer`）与默认 scope，返回类型也按厂商收窄。详细后台配置、字段说明写在**各包 README**（链接见下表）。

组织上建议：**一厂商一个 Service**——在 Service 里 `protected` 持有客户端，对外只暴露 `oauthRedirect` / `oauthCallback`；路由只调 `services.xxx`，别在 action 里散落 `new GoogleOAuth2Client`。与脚手架、[服务层](/zh/core/service) 一致。

以 Google（OIDC 整页 redirect）为例：

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

注册进 `combineServices`（工厂写成 `() => import(...)`）：

```typescript
export const services = await combineServices({
  google: () => import('@/services/google.service'),
  // github: () => import('@/services/github.service'),
});
```

路由里只调 Service：

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
    // 省略 onProfile 时：已验签的 id_token claims（sub / email …）
    // 在此写登录态：签发 Bearer / 写 Session …
    ctx.send(claims);
  },
});
```

GitHub 等同理：另建 `GithubService`，里面换 `GitHubOAuth2Client`；`callback` 默认多是 `{ base, userinfo }`。`redirectUri` 用 `(ctx) => …` 可按请求 origin 拼回调，多域名省事。

`store` 暂存 `state`（及 PKCE verifier），类型是共享的 [`Caching`](/zh/core/cache)。本地可用 memory；生产多实例换 Redis 适配器并仍传同一份 `Caching`，否则回调可能打到另一台、找不到 state。连接由 `Caching` 懒加载负责。state 默认 TTL `'10 minutes'`（`stateTtl`，`DurationInput`）；并发 callback 只有一方成功，换票失败**不会**恢复 state。

前端 GIS / One Tap 拿 `credential` 的，不要用 oauth2-google，改用下表里的 `google-identity-login`（也可同样收成一个 Service）。

### 预设一览

包在 [aomex/aomex-contrib](https://github.com/aomex/aomex-contrib)；安装形如 `pnpm add @aomex-contrib/oauth2-google @aomex/oauth2-client`。点包名进仓库看 README。

| 包 | 说明 |
| --- | --- |
| [`oauth2-google`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-google) | Google OIDC（整页 redirect） |
| [`oauth2-microsoft`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-microsoft) | Microsoft / Entra ID OIDC |
| [`oauth2-apple`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-apple) | Sign in with Apple（`form_post` + JWT `client_secret`） |
| [`oauth2-github`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-github) | GitHub OAuth App |
| [`oauth2-discord`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-discord) | Discord |
| [`oauth2-gitlab`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-gitlab) | GitLab.com |
| [`oauth2-linkedin`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-linkedin) | LinkedIn |
| [`oauth2-facebook`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-facebook) | Facebook Login |
| [`oauth2-twitter`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-twitter) | Twitter（X） |
| [`oauth2-spotify`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-spotify) | Spotify（换票常用 `tokenAuth: 'basic'`） |
| [`oauth2-wechat`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-wechat) | 微信开放平台网站扫码 / 公众号网页授权等 |
| [`oauth2-wecom`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-wecom) | 企业微信自建应用网页授权 |

**不是**整页 redirect OAuth 的，单独开了 `*-login` 包，别塞进上表流程：

| 包 | 说明 |
| --- | --- |
| [`google-identity-login`](https://github.com/aomex/aomex-contrib/tree/main/packages/google-identity-login) | Google GIS：校验 `credential` / 换 code / 拉 userinfo |
| [`wechat-mini-program-login`](https://github.com/aomex/aomex-contrib/tree/main/packages/wechat-mini-program-login) | 微信小程序 `code2Session` + 手机号（非 OAuth） |

自研又一个厂商薄封装时，可复用 [`oauth2-preset`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-preset) 的 `mergeOAuth2Preset` / `mergeOidcPreset`；业务应用一般**不用**直接依赖它。

## 手写 OAuth2Client

列表里没有、或要对接自建 IdP 时，同样收进 Service：里面 `new OAuth2Client(...)`，路由仍只调 `services.idp.oauthRedirect` 这类方法。

### 纯 OAuth2：手写端点

没有 OIDC discovery 时，必须填 `authorizationEndpoint` / `tokenEndpoint`，并提供 `onProfile`。

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

### OIDC：discovery + 验 id_token

配 `oidc.issuer`，会请求 `/.well-known/openid-configuration` 补齐端点与 jwks。scope 里若没写 `openid` 会自动补上。省略 `onProfile` 时，`callback` 直接返回**已验签** claims。

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

需要按 claims 落库时再写 `onProfile`，入参多一个 `oidc.claims`：

```typescript
onProfile: async ({ token, oidc, ctx }) => {
  return upsertUserFromClaims(oidc.claims, token);
},
```

`id_token` 里若带 `at_hash`，会与本次 `access_token` 校验；`aud` 为多值时还要求 `azp` 等于 `client_id`。可用 `oidc.jwksUri` / `expectedIssuer` 覆盖 discovery。

## 刷新与吊销

登录后业务自己存 `refresh_token`；过期前在 Service 里对 `this.oauth` 调 `refresh`。可选 `scope`（只能缩小，不能扩大）。退出或废票时调 `revoke`（需配置 `revocationEndpoint`；OIDC 未手写时会尝试 discovery 的 `revocation_endpoint`；纯 OAuth2 常需手写该 URL）。

```typescript
const tokens = await this.oauth.refresh(storedRefreshToken);
await this.oauth.revoke(tokens.access_token, {
  tokenTypeHint: 'access_token',
});
```

构造时还会常动这几项：`redirectUri` 可写固定字符串，或 `(ctx) => string` 按请求 origin 拼（多域名）；`clientSecret` 也可是 `() => string | Promise<string>`（如 Apple 动态 JWT）；`pkce` 默认 `true`（S256），极少数旧端点才关；换票凭证默认放 body，Spotify 等要用 `tokenAuth: 'basic'`；`stateTtl` 默认 `'10 minutes'`；额外授权 query 用 `authorizationParams`（不覆盖必要字段）。

::: warning
`callback` 只接受授权码流（`code` + `state`）。回调里若带隐式 / 混合流的 `id_token` 或 `token` query，会清掉 state 并抛错。用户取消授权时授权服务器常带 `error`（如 `access_denied`），校验并消费 state 后抛错——路由里自行决定提示文案。Apple 等厂商可能是 **POST form_post**，以对应预设 README 为准。
:::

## 和 Auth 怎么接

本包与预设**都不是** `@aomex/auth` 策略：产出 Profile / claims / `{ base, userinfo }` 后，你再签发自己的登录凭证。常见接法：在 `oauthCallback` 或路由里 `upsert` → `auth.strategy('bearer').signature(...)` 或写 [Session](/zh/plugins/auth-session-strategy) → 之后接口仍走 `authenticate`。

## 相关

- 仓库与包列表：[aomex-contrib](https://github.com/aomex/aomex-contrib)
- 服务注册：[服务层](/zh/core/service)
- state / 单飞 / 时长：[缓存](/zh/core/cache)
- 登录后鉴权：[统一入口 Auth](/zh/plugins/auth)
- Cookie 登录态：[Session 策略](/zh/plugins/auth-session-strategy)
- JWT 签发：[JWT 策略](/zh/plugins/auth-jwt-strategy)
