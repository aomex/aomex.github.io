---
outline: deep
---

# JWT ストラテジー

「自己完結」トークンを使うとき：ゲートウェイやサービスがローカルで署名検証し、Redis 照会を減らす。失効はだいたい短い TTL、リフレッシュトークン、またはブラックリスト。payload にパスワードを入れない。サーバー側で任意の session をすぐ無効にしたいなら、[Bearer + セッション保存](/ja/plugins/auth-bearer-strategy) の方が扱いやすいことが多い。

`@aomex/auth-jwt-strategy` を入れ、秘密鍵と onVerified を設定する。Router に authenticate('jwt') を載せ、業務では ctx.auth.jwt を読む（onVerified の戻り値そのもの。`{ token, data }` ではない）。

## インストール

```bash
pnpm add @aomex/auth
pnpm add @aomex/auth-jwt-strategy
```

## secret と onVerified

```typescript
import { Auth } from '@aomex/auth';
import { AuthJwtStrategy } from '@aomex/auth-jwt-strategy';
import { Router } from '@aomex/web';

const auth = new Auth({
  strategies: {
    jwt: new AuthJwtStrategy({
      secret: process.env.JWT_SECRET!,
      onVerified: (payload) => { // [!code highlight]
        return {
          userId: String(payload.sub),
          roles: (payload.roles as string[]) ?? [],
        };
      },
      onAuthorize(level: number) {
        const identity = this.getIdentity();
        return identity.roles.includes('admin') || level <= 1;
      },
    }),
  },
});

export const router = new Router({
  mount: [auth.authenticate('jwt')],
});

router.get('/me', {
  mount: [auth.authorize('jwt', 1)],
  action: async (ctx) => {
    ctx.send({ userId: ctx.auth.jwt.userId });
  },
});
```

ログインや更新時は action で発行する：

```typescript
const token = auth.strategy('jwt').signature(
  { sub: user.id, roles: user.roles },
  { expiresIn: '7d' },
);
```

## ctx.auth の形と Bearer の違い

| ストラテジー | `ctx.auth[name]` のおおよそ形 |
| --- | --- |
| Bearer | `{ token, data }` |
| JWT | `onVerified` が返すオブジェクトそのもの |

そのため JWT ルートではよく ctx.auth.jwt.userId と書き、ctx.auth.jwt.data.userId ではない。Bearer の ctx.auth 形と混ぜない——ストラテジー移行時は業務の取り出しパスを直す。

authorize('jwt', level) の引数型は onAuthorize の定義に従う。

::: warning
パスワードなど機密フィールドを JWT payload に書かない。ペイロードはデコードして読める。識別子とロールだけでよい。
:::

## 署名検証の締めと失効

本番ではアルゴリズムと audience を固定し、想定外のアルゴリズムを受け付けないことが多い。`onVerified` でブラックリストを見る：ヒットしたら `false` → **401**。token はデフォルトで `Authorization` Bearer から取る。Bearer と同様に cookie/query も使うなら `tokenLoaders` を追加する。

```typescript
new AuthJwtStrategy({
  secret: process.env.JWT_SECRET!,
  verifyOptions: { algorithms: ['HS256'], audience: 'api' }, // [!code highlight]
  onVerified: (payload) => {
    if (isRevoked(payload.jti)) {
      return false;
    }
    return {
      userId: String(payload.sub),
      roles: (payload.roles as string[]) ?? [],
    };
  },
});
```

管理 API をロールで塞ぐのも引き続き `onAuthorize`。インスタンスメソッドでは `this.getIdentity()`。非対称鍵や旧鍵ローテーションなど上級の設定は [上級：カスタム認証ストラテジー](/ja/advanced/auth-strategy)。

署名検証が失敗するときは、まずサーバー時計が同期しているかを疑う。失効に銀の弾丸はない：短い expiresIn + 更新 API がよくある組み合わせ。ブラックリストは自分で維持する。

## 関連

- [認証](/ja/plugins/auth)
- [Bearer ストラテジー](/ja/plugins/auth-bearer-strategy)
- [OpenAPI 生成](/ja/openapi/)
