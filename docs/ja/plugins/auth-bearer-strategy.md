---
outline: deep
---

# Bearer 戦略

最も一般的なフロントの形：`Authorization: Bearer <token>`。サーバーは不透明 token でユーザーオブジェクトに換える。通らなければ **401**。ローカル検証で DB 参照を減らすなら [JWT 戦略](/ja/plugins/auth-jwt-strategy)。失効・権限変更は別途検討が要る。

AuthBearerStrategy を設定：リクエストから token を取り、onLoaded で業務身元に。ロールが要るとき onAuthorize で比較。業務では ctx.auth.bearer.data を読む（生 token 文字列ではない）。

## インストール

Bearer は `@aomex/auth` メインに同梱。サブパスから import。

```bash
pnpm add @aomex/auth
```

```typescript
import { AuthBearerStrategy } from '@aomex/auth/bearer';
```

## onLoaded と Router マウント

```typescript
import { Auth } from '@aomex/auth';
import { AuthBearerStrategy } from '@aomex/auth/bearer';
import { Router } from '@aomex/web';

const auth = new Auth({
  strategies: {
    bearer: new AuthBearerStrategy({
      onLoaded: async (token, ctx) => {
        const row = await db.tokens.find(token);
        if (!row) {
          return false;
        }
        return { userId: row.userId, role: row.role };
      },
      onAuthorize(minRole: number) {
        return this.getIdentity().role >= minRole;
      },
    }),
  },
});

const router = new Router({ // [!code focus:10]
  mount: [auth.authenticate('bearer')], // [!code highlight]
});

router.get('/me', {
  action: async (ctx) => {
    ctx.send(ctx.auth.bearer.data);
  },
});

router.delete('/posts/:id', {
  mount: [auth.authenticate('bearer').authorize(10)],
  action: async (ctx) => {
    ctx.send(204, null);
  },
});
```

ログイン API（authenticate なし）で token 発行：

```typescript
router.post('/login', { // [!code focus:13]
  mount: [body({ email: rule.email(), password: rule.string() })],
  action: async (ctx) => {
    const user = await verifyPassword(ctx.body);
    if (!user) {
      return ctx.throw(401, 'invalid credentials');
    }

    const token = auth.strategy('bearer').signature('sha256', user.id); // [!code highlight]
    await saveSession(token, { userId: user.id, role: user.role });
    ctx.send({ token });
  },
});
```

signature が生成するのは**不透明**ランダム文字列（業務キーでドメイン分離可）。**JWT ではない**。ログインルート自体に authenticate を載せない。

認証成功後：

```typescript
ctx.auth.bearer // { token: string; data: T }
```

T は onLoaded 成功時のオブジェクト形。authorize('bearer', n) の n の型は onAuthorize に従う。

onAuthorize はインスタンスメソッド（this.getIdentity()）か柯里化——どちらか。型は戦略定義に従う：

```typescript
onAuthorize: (minRole: number) => {
  return (identity) => {
    return identity.role >= minRole;
  };
},
```

## tokenLoaders と onLoaded

| オプション | いつ使う | デフォルト |
| --- | --- | --- |
| `onLoaded` | Redis/DB で token→ユーザー。見つからなければ `false` | **必須** |
| `tokenLoaders` | 既定は `Authorization` のみ。埋め込みページなどで cookie/query | header Bearer（本番推奨；query/body はアクセスログ・Referer に残りやすい） |
| `onAuthorize` | `authorize(ロール)` が要るとき。ログイン態だけなら省略可 | 任意 |

tokenLoaders の典型：

- `{ type: 'header', key: 'authorization' }` — `Bearer <token>` の二段式のみ。生 token はここに置かない
- { type: 'body' \| 'query' \| 'cookie', key: 'access_token' } — ヘッダーが使えないときの妥協

```typescript
new AuthBearerStrategy({
  tokenLoaders: [ // [!code highlight]
    { type: 'header', key: 'authorization' },
    { type: 'query', key: 'access_token' },
  ],
  onLoaded: async (token) => {
    const session = await cache.getSession(token);
    return session || false;
  },
});
```

OpenAPI 生成時、`auth.authenticate('bearer')` を載せた**同じ** `WebApp` を `generateOpenapi({ app })` に渡すと Bearer セキュリティがドキュメントに出る。総合入口は [認証](/ja/plugins/auth)。

onLoaded が false なら未ログイン（**401**）。業務例外で代用しない（カスタムコードが要る場合を除く）。自己完結 JWT は [JWT 戦略](/ja/plugins/auth-jwt-strategy)。JWT を不透明 Bearer 文字列として検証しない。

## 関連

- [認証](/ja/plugins/auth)
- [JWT 戦略](/ja/plugins/auth-jwt-strategy)
- [OpenAPI 生成](/ja/plugins/openapi)