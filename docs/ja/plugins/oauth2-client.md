---
outline: deep
---

# OAuth2 クライアント

「相手の認可ページへ飛ぶ → code を持ち帰る → token に換える」ログインを繋ぐとき、コアパッケージは `@aomex/oauth2-client`：**OAuth 2.0 認可コード**（デフォルト **PKCE S256**）。`oidc` を付けると OpenID Connect に従って `id_token` を検証する（nonce + JWKS）。ログイン状態は引き続き自分で書く（Bearer / Session / JWT など）。

よくあるベンダーはエンドポイントを手書きしなくてよい。先に [aomex-contrib](https://github.com/aomex/aomex-contrib) の対応 `@aomex-contrib/oauth2-*` プリセットを入れる。自前 IdP や一覧に無いものは、直接 `new OAuth2Client`。

```bash
pnpm add @aomex/oauth2-client
# peer：@aomex/web @aomex/cache @aomex/common
# 有预设时再加，例如：pnpm add @aomex-contrib/oauth2-google
```

## ベンダープリセット（推奨）

プリセットパッケージが authorize / token（または OIDC `issuer`）とデフォルト scope を埋め、戻り型もベンダーに合わせて絞る。バックエンド設定やフィールドの詳細は**各パッケージ README**（リンクは下表）。

構成の推奨：**ベンダーごとに一つの Service**——Service 内で `protected` にクライアントを持ち、外へは `oauthRedirect` / `oauthCallback` だけ出す。ルートは `services.xxx` を呼ぶだけ。action に `new GoogleOAuth2Client` を散らさない。スキャフォールド、[サービス層](/ja/core/service) と同じ。

Google（OIDC のフルページ redirect）を例に：

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

`combineServices` に登録する（工場は `() => import(...)` と書く）：

```typescript
export const services = await combineServices({
  google: () => import('./google.service.js'),
  // github: () => import('./github.service.js'),
});
```

ルートでは Service だけ呼ぶ：

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

GitHub なども同様：別途 `GithubService` を作り、中で `GitHubOAuth2Client` に換える。`callback` のデフォルトはだいたい `{ base, userinfo }`。`redirectUri` を `(ctx) => …` にするとリクエスト origin からコールバックを組み立てられ、複数ドメインが楽。

`store` は一時的に `state`（と PKCE verifier）を置く。構築時に `registerLifecycle` 経由で自動 `connect` / シャットダウン時 `disconnect`。ローカルは memory でよい。本番の複数インスタンスは Redis アダプタに替える（スキャフォールドはよく `CacheRedisAdapter` をそのまま使う）。さもないとコールバックが別マシンに行き、state が見つからない。state のデフォルト TTL は `'10 minutes'`（`stateTtl`、`DurationInput`）。並行 callback は一方だけ成功し、換票失敗では state を**復元しない**。

フロントの GIS / One Tap で `credential` を取る場合は oauth2-google を使わず、下表の `google-identity-login`（同様に一つの Service にまとめてよい）。

### プリセット一覧

パッケージは [aomex/aomex-contrib](https://github.com/aomex/aomex-contrib)。インストール例は `pnpm add @aomex-contrib/oauth2-google @aomex/oauth2-client`。パッケージ名をクリックしてリポジトリの README を見る。

| パッケージ | 説明 |
| --- | --- |
| [`oauth2-google`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-google) | Google OIDC（フルページ redirect） |
| [`oauth2-microsoft`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-microsoft) | Microsoft / Entra ID OIDC |
| [`oauth2-apple`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-apple) | Sign in with Apple（`form_post` + JWT `client_secret`） |
| [`oauth2-github`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-github) | GitHub OAuth App |
| [`oauth2-discord`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-discord) | Discord |
| [`oauth2-gitlab`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-gitlab) | GitLab.com |
| [`oauth2-linkedin`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-linkedin) | LinkedIn |
| [`oauth2-facebook`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-facebook) | Facebook Login |
| [`oauth2-twitter`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-twitter) | Twitter（X） |
| [`oauth2-spotify`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-spotify) | Spotify（換票はよく `tokenAuth: 'basic'`） |
| [`oauth2-wechat`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-wechat) | WeChat オープンプラットフォームのサイト QR ログイン / 公式アカウント Web 認可など |
| [`oauth2-wecom`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-wecom) | WeCom（企業微信）の自作アプリ Web 認可 |

**フルページ redirect OAuth ではない**ものは、別途 `*-login` パッケージがある。上表の流れに入れない：

| パッケージ | 説明 |
| --- | --- |
| [`google-identity-login`](https://github.com/aomex/aomex-contrib/tree/main/packages/google-identity-login) | Google GIS：`credential` 検証 / code 換票 / userinfo 取得 |
| [`wechat-mini-program-login`](https://github.com/aomex/aomex-contrib/tree/main/packages/wechat-mini-program-login) | WeChat ミニプログラム `code2Session` + 電話番号（OAuth ではない） |

自作の薄いベンダーラップなら [`oauth2-preset`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-preset) の `mergeOAuth2Preset` / `mergeOidcPreset` を再利用できる。業務アプリは通常**直接依存しない**。

## 手書き OAuth2Client

一覧に無い、または自前 IdP に繋ぐときも、同様に Service に収める。中で `new OAuth2Client(...)`。ルートは引き続き `services.idp.oauthRedirect` のようなメソッドだけ呼ぶ。

### 素の OAuth2：エンドポイント手書き

OIDC discovery が無いときは、`authorizationEndpoint` / `tokenEndpoint` が必須で、`onProfile` も用意する。

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

### OIDC：discovery + id_token 検証

`oidc.issuer` を付けると `/.well-known/openid-configuration` を取り、エンドポイントと jwks を補う。scope に `openid` が無いと自動で足す。`onProfile` を省略すると、`callback` は**検証済み** claims をそのまま返す。

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

claims に従って DB に落とすときは `onProfile` を書く。引数に `oidc.claims` が増える：

```typescript
onProfile: async ({ token, oidc, ctx }) => {
  return upsertUserFromClaims(oidc.claims, token);
},
```

`id_token` に `at_hash` があるときは今回の `access_token` と照合する。`aud` が複数値のときは `azp` が `client_id` と等しいことも要求する。`oidc.jwksUri` / `expectedIssuer` で discovery を上書きできる。

## リフレッシュと取り消し

ログイン後、業務側で `refresh_token` を保存する。期限前に Service 内で `this.oauth` に対し `refresh` を呼ぶ。任意で `scope`（縮小のみ。拡大は不可）。ログアウトや失効時は `revoke`（`revocationEndpoint` の設定が要る。OIDC で手書きしていなければ discovery の `revocation_endpoint` を試す。素の OAuth2 ではその URL を手書きすることが多い）。

```typescript
const tokens = await this.oauth.refresh(storedRefreshToken);
await this.oauth.revoke(tokens.access_token, {
  tokenTypeHint: 'access_token',
});
```

構築時によく触る項目：`redirectUri` は固定文字列、または `(ctx) => string` でリクエスト origin から組み立て（複数ドメイン）。`clientSecret` も `() => string | Promise<string>` 可（例：Apple の動的 JWT）。`pkce` デフォルト `true`（S256）。ごく少数の古いエンドポイントだけオフ。換票の資格情報はデフォルト body。Spotify などは `tokenAuth: 'basic'`。`stateTtl` デフォルト `'10 minutes'`。追加の認可 query は `authorizationParams`（必須フィールドは上書きしない）。

::: warning
`callback` は認可コード流だけ受け付ける（`code` + `state`）。コールバックに暗黙 / 混合流の `id_token` や `token` query が付くと、state を消して例外を投げる。ユーザーが認可を取り消すと認可サーバーはよく `error`（例：`access_denied`）を付ける。state を検証・消費したあと例外——ルート側で提示文を決める。Apple などベンダーは **POST form_post** のことがある。対応プリセットの README を正とする。
:::

## Auth とのつなぎ方

本パッケージとプリセットは**どれも** `@aomex/auth` ストラテジーではない。Profile / claims / `{ base, userinfo }` を出したあと、自分のログイン資格情報を発行する。よくあるつなぎ方：`oauthCallback` またはルートで `upsert` → `auth.strategy('bearer').signature(...)` または [Session](/ja/plugins/auth-session-strategy) に書く → 以降の API は引き続き `authenticate`。

## 関連

- リポジトリとパッケージ一覧：[aomex-contrib](https://github.com/aomex/aomex-contrib)
- サービス登録：[サービス層](/ja/core/service)
- state / シングルフライト / 期間：[キャッシュ](/ja/core/cache)
- ログイン後の認証：[統一入口 Auth](/ja/plugins/auth)
- Cookie ログイン状態：[Session ストラテジー](/ja/plugins/auth-session-strategy)
- JWT 発行：[JWT ストラテジー](/ja/plugins/auth-jwt-strategy)
