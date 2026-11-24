---
outline: deep
---

# Bearer ストラテジー

フロントでいちばん多いのは `Authorization: Bearer <token>`。サーバーは不透明 token をユーザーオブジェクトに換える。通らなければ **401**。ローカルで署名検証し DB 照会を減らしたいなら [JWT ストラテジー](/ja/plugins/auth-jwt-strategy)。ただし失効と権限変更は別途の準備が要ることが多い。

AuthBearerStrategy を設定する：リクエストから token を取り、onLoaded で業務身分に換える。ロールが要るときは onAuthorize で比較する。業務では ctx.auth.bearer.data を読む。生の token 串ではない。

## インストール

Bearer は `@aomex/auth` 本体に含まれる。サブパスから import すればよい。

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

ログイン API（authenticate を載せない）で token を発行する：

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

signature が作るのは**不透明**な乱数串（業務キーを混ぜてドメイン隔離も可）。**JWT ではない**。ログインルート自体に authenticate を載せない。

認証成功後：

```typescript
ctx.auth.bearer // { token: string; data: T }
```

T は onLoaded が成功時に返すオブジェクトの形。authorize('bearer', n) の n の型はあなたの onAuthorize に従う。

onAuthorize はインスタンスメソッド（this.getIdentity()）でも、カリー化でもよい——どちらか一方。型はストラテジー定義に従う：

```typescript
onAuthorize: (minRole: number) => {
  return (identity) => {
    return identity.role >= minRole;
  };
},
```

## 複数ソースから token を取る

`onLoaded` は必須：Redis/DB を見て token をユーザーに換える。見つからなければ `false` → **401**。デフォルトは `Authorization` Bearer のみ（本番の第一選択）。埋め込みページなどでヘッダーが付けられないときだけ query / cookie / body——query、body はアクセスログや Referer に入りやすいので、避けられるなら避ける。ログイン状態だけでロールを見ないなら、`onAuthorize` は省略可。

tokenLoaders のよくある形：

- `{ type: 'header', key: 'authorization' }` — `Bearer <token>` の二段式だけ認める。素の token はここに置かない
- `{ type: 'body' | 'query' | 'cookie', key: 'access_token' }` — ヘッダーが付けられないときの妥協

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

OpenAPI 生成時は、`auth.authenticate('bearer')` を載せた同じ `WebApp` を `generateOpenapi({ app })` に渡す。Bearer のセキュリティスキームがドキュメントに出る。総入口は [認証](/ja/plugins/auth)。

onLoaded が false を返すのは未ログイン。業務例外で代用しない（カスタムエラーコードが要るとき以外）。自己完結 JWT は [JWT ストラテジー](/ja/plugins/auth-jwt-strategy)。JWT を不透明 Bearer 串として検証しない。

## 関連

- [認証](/ja/plugins/auth)
- [JWT ストラテジー](/ja/plugins/auth-jwt-strategy)
- [OpenAPI 生成](/ja/openapi/)
