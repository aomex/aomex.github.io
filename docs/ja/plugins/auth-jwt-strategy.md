---
outline: deep
---

# JWT 戦略

「自己完結」トークン：ゲートウェイやサービスがローカル検証し Redis 参照を減らす。失効は短い TTL、リフレッシュ、ブラックリストが一般的。payload にパスワードを入れない。サーバーが任意セッションを即時無効化したいなら [Bearer + セッション保存](/ja/plugins/auth-bearer-strategy) の方が扱いやすいことが多い。

`@aomex/auth-jwt-strategy` を入れ、秘密鍵と onVerified を設定。Router に authenticate('jwt')。業務では ctx.auth.jwt（onVerified の戻り。{ token, data } 構造ではない）。

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

ログインまたはリフレッシュ時に action で発行：

```typescript
const token = auth.strategy('jwt').signature(
  { sub: user.id, roles: user.roles },
  { expiresIn: '7d' },
);
```

## ctx.auth の形と Bearer の違い

| 戦略 | `ctx.auth[name]` の概形 |
| --- | --- |
| Bearer | `{ token, data }` |
| JWT | onVerified が返すオブジェクトそのもの |

JWT ルートでは ctx.auth.jwt.userId が一般的。ctx.auth.jwt.data.userId ではない。Bearer の ctx.auth 形と混ぜない——戦略移行時は業務の参照パスを変える。

authorize('jwt', level) の引数型は onAuthorize 定義に従う。

::: warning
パスワード等の機密を JWT payload に書かない。ペイロードはデコード可能。識別子とロールだけ。

:::

## verifyOptions と失効

| オプション | いつ使う |
| --- | --- |
| `secret` | 対称鍵。モノリス / 社内で一般的 |
| `tokenLoaders` | 既定 `Authorization` Bearer。必要なら Bearer 同様 cookie/query |
| `verifyOptions` | アルゴリズム、`audience` / `issuer` を絞る |
| `onVerified` | payload を業務身元に。ブラックリスト命中は `false` → 401 |
| `onAuthorize` | 管理 API をロールで遮断。インスタンスメソッドで `this.getIdentity()` |

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

非対称鍵、旧鍵ローテーションなどは [上級：カスタム認証戦略](/ja/advanced/auth-strategy)。

検証失敗時はサーバー時刻同期を疑う。失効に銀の弾はない。短い expiresIn + リフレッシュ API が一般的。ブラックリストは自前保守。

## 関連

- [認証](/ja/plugins/auth)
- [Bearer 戦略](/ja/plugins/auth-bearer-strategy)
- [OpenAPI 生成](/ja/plugins/openapi)