---
outline: deep
---

# カスタム認証ストラテジー

[Bearer](/ja/plugins/auth-bearer-strategy)、[API Key](/ja/plugins/auth-api-key-strategy)、[JWT](/ja/plugins/auth-jwt-strategy)、[Session](/ja/plugins/auth-session-strategy) が一般的な取証をカバーしています。本ページは、既存ストラテジーに合わないが次は欲しいとき用です：

- `auth.authenticate` / `authorize` に統一  
- 未ログイン **401**、権限なし **403**  
- 業務で `ctx.auth.ストラテジー名.data`  
- OpenAPI に対応する security  

典型：ゲートウェイが注入するカスタムヘッダ、mTLS から取った身元、独自署名。Cookie Session は [Session ストラテジー](/ja/plugins/auth-session-strategy) を使い、本ページで書き直さないでください。`ctx` に user を載せるだけで Auth 規約が不要なら普通の middleware でも可——ただし security と未ログイン分岐は自分で揃えます。

以下は **ゲートウェイヘッダ**（例：`x-user-id`）をルートに載せるまでです。

## ステップ 1：「身元の形」を決める

取証成功後に `ctx.auth` へ入れるデータ、例：`{ userId: number }`。ストラテジークラスの第 1 ジェネリックになり、`ctx.auth.gateway.data` の型にもなります。

第 2 ジェネリックは `authorize` の引数リスト。例：ロール名 `[string]` → 後で `.authorize('admin')`。

## ステップ 2：authenticate（取証）を実装

リクエストからクレデンシャルを取る；無い / 無効は下の契約どおり返す。**未捕捉の例外を投げない**（500 になり、クライアントがサービス障害と誤解しやすい）。

```typescript
// src/auth/gateway.strategy.ts
import { Strategy, AuthError } from '@aomex/auth';
import type { WebContext } from '@aomex/web';

export class GatewayStrategy extends Strategy<{ userId: number }, [string]> {
  protected async authenticate(ctx: WebContext) {
    const raw = ctx.request.get('x-user-id'); // [!code highlight]
    if (!raw) {
      return false; // → 401 未ログイン
    }
    const userId = Number(raw);
    if (!Number.isFinite(userId) || userId <= 0) {
      return new AuthError('invalid gateway user'); // → 401、メッセージ付き
    }
    return { userId }; // → ctx.auth へ
  }

  protected async authorize(role: string) {
    const identity = this.getIdentity();
    return userHasRole(identity.userId, role);
  }
}
```

`authenticate` の戻り値：

| 戻り値 | 挙動 |
| --- | --- |
| 身元オブジェクト | `ctx.auth` に書き、下流へ |
| `false` | 未ログイン → **401** |
| `AuthError` | メッセージ付き認証失敗 → **401** |

`authorize` が偽または `AuthError` → **403**。`authorize` 内では `this.getIdentity()` で現在の身元（authenticate 成功時のオブジェクト）を取ります。

## ステップ 3：Auth に渡す——キー名がストラテジー名

```typescript
// src/auth/index.ts
import { Auth } from '@aomex/auth';
import { GatewayStrategy } from './gateway.strategy';

export const auth = new Auth({
  strategies: {
    gateway: new GatewayStrategy(), // [!code highlight]
  },
});
```

キー名 `gateway` が決めること：

1. `auth.authenticate('gateway')`  
2. `ctx.auth.gateway`  
3. `ctx.auth.gateway.data` の形（ストラテジーのジェネリック由来）

## ステップ 4：ルートに載せて試す

公開 API と要認証 API は **Router を分ける**（または認証チェーンに `.skip`、[ミドルウェア](/ja/core/middleware)）。同一グループに押し込み感覚で迂回しない。

```typescript
import { Router } from '@aomex/web';
import { auth } from '@/auth';

export const router = new Router({
  prefix: '/admin',
  mount: [auth.authenticate('gateway')], // このグループは要ログイン
});

router.get('/dashboard', {
  mount: [auth.authenticate('gateway').authorize('admin')], // [!code highlight]
  action: async (ctx) => {
    const userId = ctx.auth.gateway.data.userId;
    ctx.send({ userId });
  },
});
```

単一ルートの `mount` だけに `authenticate` を載せることも可（Router 級でなくてよい）。連鎖の `.authorize('admin')` は `data` 型を変えません；失敗はフレームワークが 403。action でロールを再判定しなくてよいことが多い（より細かい業務権限は別）。

手で確認：

1. `x-user-id` なし → **401**  
2. ヘッダあり・ロール不足 → **403**  
3. 通過 → action で `userId` が揃う  

## ステップ 5：OpenAPI security を補う

自作ストラテジーは既定で 401 応答だけ（基底 `openapi()`）。security scheme を宣言しないと Swagger の「Authorize」がカスタムヘッダに合わず、Bearer 想定のクライアントがずっと 401 になります。

ストラテジーで `openapi()` を上書き（フィールドは型ヒントに従い、Bearer プラグインと対照）：

```typescript
import type { OpenApiInjector } from '@aomex/web';

protected override openapi(): OpenApiInjector {
  return {
    ...super.openapi(),
    onDocument(document) {
      document.components ||= {};
      document.components.securitySchemes ||= {};
      document.components.securitySchemes['gatewayUser'] ||= {
        type: 'apiKey',
        in: 'header',
        name: 'x-user-id',
      };
    },
    onMethod(methodItem) {
      methodItem.security ||= [];
      methodItem.security.push({ gatewayUser: [] });
    },
  };
}
```

OpenAPI を再生成し、当該操作の security と 401 説明が出るか確認。

::: warning
取証の仕方（ヘッダ名、Cookie 名）は security 記述と一致させる。ずれていると結合テストで 401 を繰り返します。
:::

## 自作しないとき

| 場面 | やり方 |
| --- | --- |
| 標準 Bearer / JWT / API Key / Session | プラグインストラテジー |
| ゲートウェイヘッダ、mTLS、独自署名 | カスタム `Strategy`（本ページ） |
| ヘルスチェック、静的ページ | Router 分割または `.skip`、[ミドルウェア](/ja/core/middleware) |

## JWT 非対称と鍵ローテーション（プラグインのまま）

カスタムが解くのは「取証の仕方」；JWT のアルゴリズム / ローテーションは [JWT ストラテジー](/ja/plugins/auth-jwt-strategy) を優先し、一式を書き直さない：

```typescript
import { AuthJwtStrategy } from '@aomex/auth-jwt-strategy';
import fs from 'node:fs';

new AuthJwtStrategy({
  publicKey: fs.readFileSync('public.pem'),
  privateKey: fs.readFileSync('private.pem'),
  verifyOptions: { algorithms: ['RS256'] }, // [!code highlight]
  legacySecretOrPublicKey: [oldSecret],
  onVerified: (payload) => {
    return payload;
  },
});
```

## 関連

- 入口と既存ストラテジー：[認証](/ja/plugins/auth)
- Cookie Session：[Session ストラテジー](/ja/plugins/auth-session-strategy)
- 401 / 403 JSON：[エラー形式](/ja/web/errors)
