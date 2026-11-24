---
outline: deep
---

# Session ストラテジー

ブラウザ側のログイン状態を **HttpOnly Cookie** に置く。Cookie には不透明な `sessionId` だけ。ユーザーデータは `@aomex/cache` アダプタ（memory / Redis）にある。SPA がクロスオリジンのときは [CORS](/ja/plugins/cors)（Cookie 付き）と [CSRF](/ja/plugins/csrf)（クロスサイト書き込み防止）も同時に揃える——どちらか欠けると、ログイン状態が渡らないか、第三者サイトに悪用されやすい。

「同一サイトまたは信頼できるフロント + サーバー側でいつでもセッションを無効にできる」向け。純粋なモバイル / マシン呼び出しでは [Bearer](/ja/plugins/auth-bearer-strategy) や [JWT](/ja/plugins/auth-jwt-strategy) の方が多い。

## インストール

Session ストラテジーは `@aomex/auth` 本体に含まれる。セッション保存には `@aomex/cache`（と本番用 Redis アダプタ）も要る。クロスオリジン Cookie ならさらに CORS / CSRF。

```bash
pnpm add @aomex/auth @aomex/cache
# 跨域 Cookie：pnpm add @aomex/cors @aomex/csrf
# 多实例共享会话：pnpm add @aomex/cache-redis-adapter
```

```typescript
import { AuthSessionStrategy } from '@aomex/auth/session';
```

## 先に CORS と CSRF を載せる

クロスオリジンのフロントが Cookie を付けるには、ブラウザの要件として：

1. リクエストに `credentials: 'include'`（または XHR `withCredentials`）
2. 応答に `Access-Control-Allow-Credentials: true`、かつ `Access-Control-Allow-Origin` が**具体ドメイン**（`*` 不可）
3. 書き込みに CSRF ヘッダー。さもないと他人のページがあなたの Cookie を「借りて」POST できる

`credentials: true` のときは **必ず `origin` を明示**する。無引数 cors() のデフォルト反射に頼らない——起動時に例外になる。CSRF はダブルサブミット Cookie：読める Cookie `csrfToken` とリクエストヘッダー `x-csrf-token` が一致したときだけ通す。

```typescript
import { cors } from '@aomex/cors';
import { csrf } from '@aomex/csrf';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
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
ローカルでポートが分かれているときは、origin を `http://localhost:5173`（またはフロントのアドレス）にする。`*` は使わない。同一サイト配備（フロントと API が同じ origin）なら cors() は省略できるが、CSRF は載せておくのがよい。
:::

マウント順：cors → csrf → routers。どちらも routers の**前**。エラー応答にも CORS / 発行直後の CSRF Cookie が付く。

フロントがデータを変えるリクエストのおおよそは：

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

GET など安全メソッドはデフォルトで CSRF を検証しない。初回アクセスで `csrfToken` Cookie が発行される（`HttpOnly=false`、JS から読める）。詳細は [CSRF](/ja/plugins/csrf)。

## store、cookie、onLoaded

`cookie.maxAge`（秒）は必須で、同時にキャッシュ TTL になる。`onLoaded` は cache に入れた Stored を業務身分にまとめる。ユーザーがすでにログアウトなら `false` → **401**。

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
        // 生产跨站前端常见：sameSite: 'none', secure: true
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

本番や複数インスタンスでは Redis など外付けアダプタに替える。[キャッシュ](/ja/core/cache) を参照。Cookie のデフォルト名は `sessionId`。`setCookie` のデフォルトは `httpOnly: true`、`sameSite: Strict`（クロスサイトフロントは `'none'` にして `secure` をオン）。`cookie.name` / `path` / `domain` はフロントのドメインに合わせる。

活発なユーザーが強制ログアウトされにくいようにするなら `sliding`：認証成功のたびに TTL + Cookie を延長。カスタムキャッシュキー接頭辞は `generateCacheKey`（デフォルト `auth:session:${sessionId}`）。`authorize(ロール)` が要るときだけ `onAuthorize` を書く。

## ログイン、認証、ログアウト

ログインルートに `authenticate` を**載せない**。`strategy.login(ctx, stored)` でキャッシュを書き Cookie を付ける（新しい `sessionId` を発行。リクエストに古い Cookie があれば、書き込み成功後に旧セッションを削除）。プライベート API に `authenticate('session')` を載せ、`ctx.auth.session` を読む。

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

`data` は `onLoaded` の戻り値。`logout` はキャッシュを消し Cookie をクリア。`touch` は延長だけで保存内容は変えない。昇格や機微操作のあと id を回すときは `regenerateSessionId(ctx)`（新しい Stored を渡してもよい）。

::: warning
クロスオリジンではフロントが必ず `credentials: 'include'`。さもないとブラウザが `sessionId` Cookie を付けず、「ログイン成功なのにすぐ 401」に見える。
:::

## Bearer / JWT との選び方

| | Session | Bearer / JWT |
| --- | --- | --- |
| 資格情報の置き場 | HttpOnly Cookie | ヘッダー / ローカルストレージ |
| クロスオリジン | CORS credentials + 多くの場合 CSRF | だいたい `Authorization` だけ |
| 失効 | キャッシュを消すだけ | Bearer はセッション削除。JWT は短い TTL / ブラックリスト |
| 典型クライアント | ブラウザ SPA / 管理画面 | App、オープンプラットフォーム、サービス間 |

同一サイトの管理画面は Session 優先。公開 API は Bearer または JWT 優先。総入口は [認証](/ja/plugins/auth)。

## 関連

- [クロスオリジン CORS](/ja/plugins/cors)
- [CSRF](/ja/plugins/csrf)
- [認証](/ja/plugins/auth)
- [キャッシュ](/ja/core/cache)
- [Bearer ストラテジー](/ja/plugins/auth-bearer-strategy)
