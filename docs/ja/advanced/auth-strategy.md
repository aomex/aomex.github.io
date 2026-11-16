---
outline: deep
---

# カスタム認証ストラテジ

[Bearer](/ja/plugins/auth-bearer-strategy)、[API Key](/ja/plugins/auth-api-key-strategy)、[JWT](/ja/plugins/auth-jwt-strategy) は「Header に Token / Key を載せる」大半の API をカバーしている。このページで手を動かすのは、資格情報の取り方が既成ストラテジに合わないが、次は守りたいときが多い：

- `auth.authenticate` / `authorize` に統一する  
- 未ログイン **401**、権限なし **403**  
- ビジネスコードで `ctx.auth.<strategy>.data` を使う  
- OpenAPI に対応する security がある  

典型例：Cookie セッション、ゲートウェイが注入するカスタムヘッダ、mTLS で取り出したアイデンティティ。単に `ctx` に user を載せて Auth の約束を気にしないなら、通常のミドルウェアでも動く——ただし security と未ログイン分岐は自分で全部用意する。

以下では **Cookie セッション**をゼロからルートにマウントするまでやる。

## ステップ1：アイデンティティの形を決める

ログイン成功後に `ctx.auth` に入れるデータを先に決める。例：`{ userId: number }`。これがストラテジクラスの第一ジェネリックになり、`ctx.auth.session.data` の型にもなる。

第二ジェネリックは `authorize` の引数リスト。例：ロール名 `[string]` → あとで `.authorize('admin')` と書く。

## ステップ2：authenticate を実装する（資格情報の取得）

リクエストから資格情報を取り出す。ない / 無効なら約束どおり返す。**捕捉されていない例外は投げない**（さもないと 500 になり、クライアントはサービス障害と思いがち）。

```typescript
// src/auth/session.strategy.ts
import { Strategy, AuthError } from '@aomex/auth';
import type { WebContext } from '@aomex/web';

export class SessionStrategy extends Strategy<{ userId: number }, [string]> {
  protected async authenticate(ctx: WebContext) {
    const sid = ctx.request.cookies?.['sid']; // [!code highlight]
    if (!sid) {
      return false; // → 401 未登录
    }
    const user = await findBySession(sid);
    if (!user) {
      return new AuthError('session expired'); // → 401，带消息
    }
    return { userId: user.id }; // → 写入 ctx.auth
  }

  protected async authorize(role: string) {
    const identity = this.getIdentity();
    return userHasRole(identity.userId, role);
  }
}
```

`authenticate` の戻り値の約束：

| 戻り値 | 挙動 |
| --- | --- |
| アイデンティティオブジェクト | `ctx.auth` に書き込み、下流へ |
| `false` | 未ログイン → **401** |
| `AuthError` | メッセージ付き認証失敗 → **401** |

`authorize` が false または `AuthError` → **403**。`authorize` 内では `this.getIdentity()` で現在のアイデンティティ（authenticate 成功時のオブジェクト）を取得する。

## ステップ3：Auth に渡す——キー名がストラテジ名

```typescript
// src/auth/index.ts
import { Auth } from '@aomex/auth';
import { SessionStrategy } from './session.strategy.js';

export const auth = new Auth({
  strategies: {
    session: new SessionStrategy(), // [!code highlight]
  },
});
```

ここでのキー名 `session` が次の三つを決める：

1. `auth.authenticate('session')`  
2. `ctx.auth.session`  
3. `ctx.auth.session.data` の形（ストラテジのジェネリック由来）

## ステップ4：ルートにマウントして試す

公開ログイン API と要認証 API は **Router を分ける**（または認証チェーンに `.skip`。[ミドルウェア](/ja/core/middleware) 参照）。同じグループに詰め込んで感覚で bypass しない。

```typescript
import { Router } from '@aomex/web';
import { auth } from '../auth/index.js';

export const router = new Router({
  prefix: '/admin',
  mount: [auth.authenticate('session')], // 本组都要登录
});

router.get('/dashboard', {
  mount: [auth.authenticate('session').authorize('admin')], // [!code highlight]
  action: async (ctx) => {
    const userId = ctx.auth.session.data.userId;
    ctx.send({ userId });
  },
});
```

単一ルートの `mount` にだけ `authenticate` を載せてもよく、Router 全体である必要はない。チェーンの `.authorize('admin')` は `data` の型を変えない。失敗はフレームワークが 403 を返すので、action で再度ロール判定する必要はふつうない（より細かい業務権限は別）。

手動で確認：

1. Cookie なし → **401**  
2. Cookie あり、ロール不足 → **403**  
3. 成功 → action で `userId` に補完がある  

## ステップ5：OpenAPI security を足す

自作ストラテジはデフォルトで 401 レスポンスだけ（基底の `openapi()`）。security scheme を宣言しないと、Swagger の「Authorize」が Cookie / カスタムヘッダと合わず、Bearer 前提の生成クライアントはずっと 401 になる。

ストラテジで `openapi()` をオーバーライド（フィールドは型ヒントに従い、Bearer プラグインと照合）：

```typescript
import type { OpenApiInjector } from '@aomex/web';

protected override openapi(): OpenApiInjector {
  return {
    ...super.openapi(),
    onDocument(document) {
      document.components ||= {};
      document.components.securitySchemes ||= {};
      document.components.securitySchemes['sessionCookie'] ||= {
        type: 'apiKey',
        in: 'cookie',
        name: 'sid',
      };
    },
    onMethod(methodItem) {
      methodItem.security ||= [];
      methodItem.security.push({ sessionCookie: [] });
    },
  };
}
```

OpenAPI を再生成し、その operation に security と 401 の説明があるか確認する。

::: warning
資格情報の取り方（Cookie 名、ヘッダ名）は security の記述と一致させること。さもないと結合テストで 401 が繰り返し出る。
:::

## 自前実装しない方がよい場面

| 場面 | やり方 |
| --- | --- |
| 標準 Bearer / JWT / API Key | プラグインストラテジ |
| Cookie、ゲートウェイヘッダ、独自署名 | カスタム `Strategy`（本ページ） |
| ヘルスチェック、静的ページ | Router を分けるか `.skip`。[ミドルウェア](/ja/core/middleware) 参照 |

## JWT 非対称鍵と鍵ローテーション（プラグインのまま）

カスタムストラテジが解くのは「資格情報の取り方」。JWT のアルゴリズム / ローテーションは [JWT ストラテジ](/ja/plugins/auth-jwt-strategy) を優先し、一式を書き直す必要はない：

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

- 統一エントリと既成ストラテジ：[認証](/ja/plugins/auth)
- 401 / 403 の JSON：[エラー形式](/ja/web/errors)
