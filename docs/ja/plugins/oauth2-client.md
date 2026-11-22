---
outline: deep
---

# OAuth2 クライアント

「認可ページへ遷移 → code を持ち帰る → token を交換」するログインのコアは `@aomex/oauth2-client`：**OAuth 2.0 認可コード**（既定 **PKCE S256**）。`oidc` を付けると OpenID Connect として `id_token` を検証する（nonce + JWKS）。ログイン状態は自分で書く（Bearer / Session / JWT など）。

よく使うベンダーは端点を手書きしない。[aomex-contrib](https://github.com/aomex/aomex-contrib) の `@aomex-contrib/oauth2-*` を入れる。自前 IdP や一覧に無いときだけ `OAuth2Client` を直接作る。

```bash
pnpm add @aomex/oauth2-client
# peer：@aomex/web @aomex/cache @aomex/common
# プリセットがあるとき例：pnpm add @aomex-contrib/oauth2-google
```

## ベンダープリセット（推奨）

プリセットは authorize / token（または OIDC `issuer`）と既定 scope を埋め、戻り型もベンダー向けに絞る。管理画面の手順やフィールド説明は**各パッケージの README**（下表のリンク）。

構成は**ベンダーごとに一つの Service**——Service 内でクライアントを `protected` に持ち、外には `oauthRedirect` / `oauthCallback` だけ。ルートは `services.xxx` を呼び、action に `new GoogleOAuth2Client` を散らさない。スキャフォールドと[サービス層](/ja/core/service)と同じ形。

Google（OIDC・ページ全体 redirect）の例：

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

`combineServices` に登録（工場は `() => import(...)`）：

```typescript
export const services = await combineServices({
  google: () => import('./google.service.js'),
  // github: () => import('./github.service.js'),
});
```

ルートは Service だけを呼ぶ：

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
    // onProfile 省略時：検証済み id_token claims（sub / email …）
    // ここでログイン状態を書く：Bearer / Session など
    ctx.send(claims);
  },
});
```

GitHub も同様：別の `GithubService` に `GitHubOAuth2Client`。`callback` は多くの場合 `{ base, userinfo }`。`redirectUri` を関数にすると `ctx.request.origin` からコールバックを組み立てられ、複数ドメインに便利。

`store` は `state`（と PKCE verifier）を一時保存する。コンストラクタが `registerLifecycle` で自動 `connect` / 終了時 `disconnect`。ローカルは memory でよい。本番の複数インスタンスは Redis アダプタ（スキャフォールドはしばしば `CacheRedisAdapter` を直接使う）。そうしないと callback が別マシンに当たり state が見つからない。state の既定 TTL は `'10 minutes'`（`stateTtl`、`DurationInput`）。同時 callback は一方だけ成功。交換失敗時に state は**戻さない**。

フロントの GIS / One Tap で `credential` を取る場合は oauth2-google ではなく、下表の `google-identity-login`（同様に一つの Service にしてよい）。

### プリセット一覧

パッケージは [aomex/aomex-contrib](https://github.com/aomex/aomex-contrib)。`pnpm add @aomex-contrib/oauth2-google @aomex/oauth2-client` のように入れる。パッケージ名をクリックして README を読む。

| パッケージ | 説明 |
| --- | --- |
| [`oauth2-google`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-google) | Google OIDC（ページ全体の redirect） |
| [`oauth2-microsoft`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-microsoft) | Microsoft / Entra ID OIDC |
| [`oauth2-apple`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-apple) | Sign in with Apple (`form_post` + JWT `client_secret`) |
| [`oauth2-github`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-github) | GitHub OAuth App |
| [`oauth2-discord`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-discord) | Discord |
| [`oauth2-gitlab`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-gitlab) | GitLab.com |
| [`oauth2-linkedin`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-linkedin) | LinkedIn |
| [`oauth2-facebook`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-facebook) | Facebook Login |
| [`oauth2-twitter`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-twitter) | Twitter (X) |
| [`oauth2-spotify`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-spotify) | Spotify（トークン交換は多くの場合 `tokenAuth: 'basic'`） |
| [`oauth2-wechat`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-wechat) | WeChat 開放プラットフォーム（サイト QR）/ 公式アカウント Web 認可など |
| [`oauth2-wecom`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-wecom) | 企業微信（WeCom）自作アプリの Web 認可 |

**ページ全体の redirect OAuth ではない**もの。別の `*-login` パッケージ：

| パッケージ | 説明 |
| --- | --- |
| [`google-identity-login`](https://github.com/aomex/aomex-contrib/tree/main/packages/google-identity-login) | Google GIS：`credential` の検証 / code 交換 / userinfo 取得 |
| [`wechat-mini-program-login`](https://github.com/aomex/aomex-contrib/tree/main/packages/wechat-mini-program-login) | WeChat ミニプログラム `code2Session` + 電話番号（OAuth ではない） |

別ベンダーの薄いラッパーを自作するときは [`oauth2-preset`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-preset) の `mergeOAuth2Preset` / `mergeOidcPreset` を使える。業務アプリが**直接**依存する必要は通常ない。

## 手書き `OAuth2Client`

一覧に無い、または自前 IdP のときも Service に収める。中で `new OAuth2Client(...)`、ルートは `services.idp.oauthRedirect` のようなメソッドだけを呼ぶ。

### 素の OAuth2：エンドポイント手書き

OIDC discovery が無いときは `authorizationEndpoint` / `tokenEndpoint` と `onProfile` が必須。

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

`oidc.issuer` を設定すると `/.well-known/openid-configuration` を読む。scope に `openid` が無ければ自動追加。`onProfile` を省略すると `callback` は**検証済み** claims を返す。

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

claims を業務ユーザーへ写すときは `onProfile`（引数に `oidc.claims`）：

```typescript
onProfile: async ({ token, oidc, ctx }) => {
  return upsertUserFromClaims(oidc.claims, token);
},
```

`id_token` に `at_hash` があれば今回の `access_token` と照合。`aud` が複数なら `azp` は `client_id` と一致が必要。`oidc.jwksUri` / `expectedIssuer` で discovery を上書きできる。

## リフレッシュと取り消し

ログイン後は自分で `refresh_token` を保存し、期限前に Service 内で `this.oauth.refresh` を呼ぶ。任意の `scope` は縮小のみ。ログアウトや失効は `revoke`（`revocationEndpoint` が必要。OIDC で未指定なら discovery の `revocation_endpoint`）。

```typescript
const tokens = await this.oauth.refresh(storedRefreshToken);
await this.oauth.revoke(tokens.access_token, {
  tokenTypeHint: 'access_token',
});
```

## よく変えるオプション

| オプション | 役割 |
| --- | --- |
| `redirectUri` | 固定文字列、または `(ctx) => string`（複数ドメイン） |
| `clientSecret` | 文字列、または `() => string \| Promise<string>`（Apple の動的 JWT など） |
| `pkce` | 既定 `true`（S256）。古いエンドポイントだけオフ |
| `tokenAuth` | 交換時の資格情報：`body`（既定）または `basic` |
| `stateTtl` | state の寿命。既定 `'10 minutes'` |
| `authorizationParams` | 認可 URL に足す query（必須フィールドは上書きしない） |
| `revocationEndpoint` | 取り消し URL。素の OAuth2 では手書きが多い |

::: warning
`callback` は認可コード流（`code` + `state`）だけ。暗黙 / ハイブリッドの `id_token` や `token` query は state を消してエラー。ユーザーが取り消すと `error`（例：`access_denied`）が返り、state 検証・消費のあと throw。Apple などは **POST form_post** のことがある——対応プリセットの README に従う。
:::

## Auth とのつなぎ方

コアもプリセットも `@aomex/auth` 戦略ではない。Profile / claims / `{ base, userinfo }` を出したあと、自分で資格情報を発行する。典型：`oauthCallback` やルートで upsert → `auth.strategy('bearer').signature(...)` または [Session](/ja/plugins/auth-session-strategy) → 以降は `authenticate`。

## 関連

- リポジトリとパッケージ一覧：[aomex-contrib](https://github.com/aomex/aomex-contrib)
- サービス登録：[サービス層](/ja/core/service)
- state / 単飛 / 時間：[キャッシュ](/ja/core/cache)
- ログイン後の認証：[Auth 統一入口](/ja/plugins/auth)
- Cookie ログイン：[Session ストラテジー](/ja/plugins/auth-session-strategy)
- JWT 発行：[JWT 戦略](/ja/plugins/auth-jwt-strategy)
