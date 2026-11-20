---
outline: deep
---

# Session ストラテジー

ブラウザ側のログイン状態を **HttpOnly Cookie** に置く。Cookie には不透明な `sessionId` だけを入れ、ユーザーデータは `@aomex/cache` アダプター（memory / Redis）に置く。SPA がクロスオリジンのときは [CORS](/ja/plugins/cors)（Cookie 送信）と [CSRF](/ja/plugins/csrf)（クロスサイト書き込み防止）もセットで要る——どちらか欠けると、ログイン状態が届かないか、第三者サイトに悪用されやすい。

「同一オリジンまたは信頼できるフロント + サーバー側でいつでもセッション破棄」向け。モバイル単体やマシン間呼び出しなら [Bearer](/ja/plugins/auth-bearer-strategy) や [JWT](/ja/plugins/auth-jwt-strategy) の方が多い。

## インストール

Session ストラテジーは `@aomex/auth` 本体に含まれる。セッション保存には `@aomex/cache`（本番の Redis アダプターも）が要る。クロスオリジン Cookie なら CORS / CSRF も追加。

```bash
pnpm add @aomex/auth @aomex/cache
# クロスオリジン Cookie：pnpm add @aomex/cors @aomex/csrf
# 複数インスタンスでセッション共有：pnpm add @aomex/cache-redis-adapter
```

```typescript
import { AuthSessionStrategy } from '@aomex/auth/session';
```

## 先に CORS と CSRF を載せる

クロスオリジンのフロントが Cookie を送るとき、ブラウザは次を要求する：

1. リクエストに `credentials: 'include'`（または XHR `withCredentials`）
2. 応答に `Access-Control-Allow-Credentials: true`、かつ `Access-Control-Allow-Origin` が**具体的なドメイン**（`*` 不可）
3. 書き込みに CSRF ヘッダー。無いと他人のページがあなたの Cookie を「借りて」POST できる

`credentials: true` のときは **`origin` を明示必須**。無引数 cors() のデフォルト反射には頼れない——起動時に例外になる。CSRF はダブルサブミット Cookie：読める Cookie `csrfToken` とヘッダー `x-csrf-token` が一致したときだけ通す。

```typescript
import { cors } from '@aomex/cors';
import { csrf } from '@aomex/csrf';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'ja-JP' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:8]
    cors({
      origin: 'https://app.example.com',
      credentials: true,
      allowHeaders: ['Content-Type', 'x-csrf-token'],
    }),
    csrf(),
    routers('./src/routers'),
  ],
});
```

::: tip
ローカルでポートが分かれているときは origin を `http://localhost:5173`（またはフロントの URL）に。`*` は使わない。同一オリジン配備なら cors() は省略できるが、CSRF は載せたままがよい。
:::

マウント順：cors → csrf → routers。どちらも routers の**前**に置く。そうしないとエラー応答に CORS / 発行直後の CSRF Cookie が付かない。

フロントの更新系リクエストの例：

```typescript
const csrfToken = document.cookie
  .split('; ')
  .find((row) => row.startsWith('csrfToken='))
  ?.split('=')[1];

await fetch('https://api.example.com/api/posts', {
  method: 'POST',
  credentials: 'include', // [!code highlight]
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken!, // [!code highlight]
  },
  body: JSON.stringify({ title: 'hi' }),
});
```

GET など安全なメソッドはデフォルトで CSRF を検証しない。初回アクセスで `csrfToken` Cookie を発行する（`HttpOnly=false`、JS から読める）。詳細は [CSRF](/ja/plugins/csrf)。

## store、cookie、onLoaded

`cookie.maxAge`（秒）は必須で、キャッシュ TTL にもなる。`onLoaded` は cache に入れた Stored を業務身元に変換する。退会済みなら `false` → **401**。

```typescript
import { Auth } from '@aomex/auth';
import { AuthSessionStrategy } from '@aomex/auth/session';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import { body, Router } from '@aomex/web';
import { rule } from '@aomex/common';

const auth = new Auth({
  strategies: {
    session: new AuthSessionStrategy({
      store: new CacheMemoryAdapter(), // [!code highlight]
      cookie: {
        maxAge: 7 * 24 * 3600,
        // 本番のクロスサイトフロントではよく: sameSite: 'none', secure: true
      },
      onLoaded: async (data: { userId: number }) => {
        const user = await findActiveUser(data.userId);
        return user ?? false;
      },
      onAuthorize(minRole: number) {
        return this.getIdentity().role >= minRole;
      },
    }),
  },
});
```

本番や複数インスタンスでは Redis など外部アダプターに。[キャッシュ](/ja/core/cache) を参照。Cookie 名のデフォルトは `sessionId`。`setCookie` のデフォルトは `httpOnly: true`、`sameSite: Strict`（クロスサイトフロントは `'none'` と `secure`）。

| オプション | いつ使うか |
| --- | --- |
| `store` | セッションの置き場。ローカルは memory、複数レプリカは Redis |
| `cookie.maxAge` | セッション有効秒数。**必須** |
| `cookie.name` / `path` / `domain` / `sameSite` / `secure` | フロントドメイン・クロスサイト有無に合わせる |
| `sliding` | 認証成功のたびに TTL + Cookie を延長。アクティブユーザーの強制ログアウトを減らす |
| `generateCacheKey` | キー接頭辞のカスタム。デフォルト `auth:session:${sessionId}` |
| `onLoaded` | Stored → 業務身元。DB 照会・失効 |
| `onAuthorize` | `authorize(ロール)` が要るときだけ |

## ログイン、認証、ログアウト

ログインルートに `authenticate` を**載せない**。`strategy.login(ctx, stored)` でキャッシュ書き込みと Cookie 設定（新しい `sessionId` を発行。リクエストに古い Cookie があれば、新セッション成功後に旧セッションを削除）。保護 API には `authenticate('session')`、読み取りは `ctx.auth.session`。

```typescript
const session = auth.strategy('session');

export const publicRouter = new Router({ prefix: '/api' });

publicRouter.post('/login', { // [!code focus:12]
  mount: [body({ email: rule.email(), password: rule.string() })],
  action: async (ctx) => {
    const user = await verifyPassword(ctx.body);
    if (!user) {
      return ctx.throw(401, 'invalid credentials');
    }

    await session.login(ctx, { userId: user.id }); // [!code highlight]
    ctx.send({ ok: true });
  },
});

publicRouter.post('/logout', {
  action: async (ctx) => {
    await session.logout(ctx);
    ctx.send(204, null);
  },
});

export const privateRouter = new Router({
  prefix: '/api',
  mount: [auth.authenticate('session')],
});

privateRouter.get('/me', {
  action: async (ctx) => {
    ctx.send(ctx.auth.session.data); // [!code highlight]
  },
});
```

認証成功後：

```typescript
ctx.auth.session // { sessionId: string; data: Loaded }
```

`data` は `onLoaded` の戻り値。`logout` はキャッシュ削除と Cookie 削除。`touch` は TTL だけ延長。権限昇格や機微操作のあとに id を回すなら `regenerateSessionId(ctx)`（新しい Stored を渡してもよい）。

::: warning
クロスオリジンではフロントが必ず `credentials: 'include'` を付ける。付けないとブラウザが `sessionId` Cookie を送らず、「ログイン成功なのにすぐ 401」に見える。
:::

## Bearer / JWT との選び方

| | Session | Bearer / JWT |
| --- | --- | --- |
| 資格情報の置き場 | HttpOnly Cookie | ヘッダー / ローカルストレージ |
| クロスオリジン | CORS credentials + 多くの場合 CSRF | だいたい `Authorization` だけ |
| 失効 | キャッシュ削除で足りる | Bearer はセッション削除；JWT は短い TTL / ブラックリスト |
| 典型クライアント | ブラウザ SPA / 管理画面 | App、オープンプラットフォーム、サービス間 |

同一オリジンの管理画面は Session 優先。公開 API は Bearer か JWT。総入口は [認証](/ja/plugins/auth)。

## 関連

- [CORS](/ja/plugins/cors)
- [CSRF](/ja/plugins/csrf)
- [認証](/ja/plugins/auth)
- [キャッシュ](/ja/core/cache)
- [Bearer 戦略](/ja/plugins/auth-bearer-strategy)
