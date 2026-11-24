---
outline: deep
---

# 認証

まず二つを分ける：**この人は誰か**（認証）と、**この操作ができるか**（認可）。`@aomex/auth` は複数ストラテジーを一つの Auth インスタンスにまとめる。身分が通らなければだいたい **401**、身分はあるが権限が足りなければ **403**。フロントと監視はこれで「ログインへ」か「アカウント変更 / 権限昇格」かを判断できる。

一連の業務 API に「先にログイン必須」を付け、一部だけより高いロールが要る。ログイン API 自体には認証を載せない。入ったあと `ctx.auth` で身分が読める。

## インストール

使うストラテジーに合わせてパッケージを入れる。まだログインを作っていないなら、このページを道筋として読んでよい。

```bash
pnpm add @aomex/auth
# JWT 另装：pnpm add @aomex/auth-jwt-strategy
# Session 另需：pnpm add @aomex/cache（跨域再加 @aomex/cors @aomex/csrf）
```

| ストラテジーパッケージ | 典型シーン |
| --- | --- |
| [`@aomex/auth/bearer`](/ja/plugins/auth-bearer-strategy) | 不透明 token。サーバー側にセッションを持つ |
| [`@aomex/auth/session`](/ja/plugins/auth-session-strategy) | ブラウザ Cookie ログイン。CORS + CSRF と併用 |
| [`@aomex/auth/api-key`](/ja/plugins/auth-api-key-strategy) | マシン間・オープンプラットフォーム |
| [`@aomex/auth-jwt-strategy`](/ja/plugins/auth-jwt-strategy) | 自己完結 JWT。DB 照会を減らす |
| [`@aomex/oauth2-client`](/ja/plugins/oauth2-client) | 第三者認可コードログイン。よくあるベンダーは [aomex-contrib](https://github.com/aomex/aomex-contrib) プリセット（Auth ストラテジーではない。コールバック後に上のいずれかを発行） |

## 一連のプライベート API：Router に authenticate

`Auth` インスタンスに各ストラテジー（Bearer / Session / API Key / JWT）を登録する。`authenticate(name)` は「先に身分を見る」ミドルウェアを返す。一連の API がすべて先にログイン必須なら `Router.mount` に載せる。通ったあと `ctx.auth[name]` で身分が読める。

```typescript
import { Auth } from '@aomex/auth';
import { AuthBearerStrategy } from '@aomex/auth/bearer';
import { Router } from '@aomex/web';

const auth = new Auth({
  strategies: {
    bearer: new AuthBearerStrategy({
      onLoaded: async (token) => {
        const user = await findUserByToken(token);
        return user ?? false; // false → 401
      },
      onAuthorize(minRole: number) {
        return this.getIdentity().role >= minRole;
      },
    }),
  },
});

export const router = new Router({ // [!code focus:10]
  prefix: '/api',
  mount: [auth.authenticate('bearer')], // [!code highlight]
});

router.get('/profile', {
  action: async (ctx) => {
    ctx.send(ctx.auth.bearer.data);
  },
});

router.delete('/posts/:id', {
  mount: [auth.authorize('bearer', 10)],
  action: async (ctx) => {
    ctx.send(204, null);
  },
});
```

- `ctx.auth.bearer` は `authenticate('bearer')` を載せ、通過したあとに意味を持つ。型にはストラテジー名のフィールドが付く。
- `authorize('bearer', 10)` の第 2 引数の型は、ストラテジーに書いた `onAuthorize` のシグネチャから来る（数値、権限コードなど）。失敗はだいたい **403**——対応ストラテジーの認証を**すでに**通っている前提。authorize だけ載せて authenticate を忘れると、実行時は型ほど助けてくれない。

同じルートで「先にログイン、次に権限」ならチェーンで書ける：

```typescript
router.post('/admin/reboot', {
  mount: [auth.authenticate('bearer').authorize(99)], // [!code highlight]
  action: async (ctx) => {
    // …
  },
});
```

## ログインでの発行

ログインやトークン更新では、業務コードで `auth.strategy(name)` を使い資格情報を発行する（Bearer の乱数串、JWT payload など）。**ログインルートに authenticate を載せない**。さもないと token 無しでは永遠に入れない。

```typescript
// 登录成功后签发（示例）
const token = auth.strategy('bearer').signature('sha256', user.id);
```

## 公開 API を認証済み Router に無理に入れない

| 位置 | 向くもの |
| --- | --- |
| `Router.mount` | 一連のプライベート API |
| 単一ルート `mount` | 個別の公開 / より厳しい認可。公開 API と同じファイルに混在するとき |
| `WebApp.mount` | ほぼサイト全体がプライベート。ヘルスチェックなどは別 Router |

公開 API を認証済み Router に無理に入れない。authenticate なしの Router を分ける方が、あちこち skip するより保守しやすい。繰り返す `authorize(...)` は定数に抜いてよい。

未ログイン / token 無効は **401**。ログイン済みだがロール不足は **403**。同じ意味に混ぜない。OpenAPI 生成時は `generateOpenapi` に本番と同じ `app` を渡し、ドキュメントの security が実認証と揃うようにする。複数ストラテジーでは `authenticate('jwt')` などの名前を strategies のキーと一致させる。

## 関連

- [Bearer ストラテジー](/ja/plugins/auth-bearer-strategy)
- [Session ストラテジー](/ja/plugins/auth-session-strategy)
- [API Key ストラテジー](/ja/plugins/auth-api-key-strategy)
- [JWT ストラテジー](/ja/plugins/auth-jwt-strategy)
- 第三者認可コードログイン：[OAuth2 クライアント](/ja/plugins/oauth2-client)
- プロトコルが特殊なとき：[上級：カスタム認証ストラテジー](/ja/advanced/auth-strategy)
