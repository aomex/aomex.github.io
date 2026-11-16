---
outline: deep
---

# パスパラメータ

ルートを `/users/:id` のように書くと、マッチしたセグメントは最初 **文字列** で `ctx.request.params` に載る。mount の `params()` で型と範囲を検証し、業務は `ctx.params`。形が不正 **400**、実体なしは別途 **404**。

```typescript
import { rule } from '@aomex/common';
import { params, Router } from '@aomex/web';

export const router = new Router();

router.get('/users/:id', { // [!code focus:15]
  mount: [
    params({ // [!code highlight]
      id: rule.int().min(1),
    }),
  ],
  action: async (ctx) => {
    const { id } = ctx.params;
    const user = await findUser(id);
    if (!user) {
      ctx.throw(404, 'user not found');
    }
    ctx.send(user);
  },
});
```
:id は任意文字列にマッチするだけで合法 ID ではない——範囲・UUID はバリデータへ。形の誤り **400**、存在しない **404**。監視で typo を欠損と混同しない。

`params({ id: rule.int().min(1) })` のあと `ctx.params.id` は number。テンプレート `:userId` と schema キー `userId` は一致必須。`params()` なしは文字列のまま——"42" と 42 が混ざりやすい。ルート自体がマッチしなければ `params()` は走らず 404。それは検証 400 ではない。

`:userId` なのに `params({ id: ... })` はキー不一致。query で id を重複させ query 優先も避ける——パスと query 不一致はキャッシュ・権限・ログが乱れる。

## UUID と多段パス

公開 ID が UUID なら `rule.uuid()`。`/users/:userId/posts/:postId` は**同一** `params({ ... })` に全キー。キー名はテンプレートと一致。

UUID 公開リソース：

```typescript
params({ id: rule.uuid() }),
```

```typescript
router.get('/users/:userId/posts/:postId', { // [!code focus:12]
  mount: [
    params({ // [!code highlight]
      userId: rule.int().min(1),
      postId: rule.int().min(1),
    }),
  ],
  action: async (ctx) => {
    const { userId, postId } = ctx.params;
    ctx.send({ userId, postId });
  },
});
```
## param schema の再利用

`:id` が複数ルートに繰り返すなら `params` 形状を schema ファイルへ。[body / query 再利用](/ja/web/body) と同型。int → uuid 変更は schema 1箇所。

```typescript
// src/schemas/user-id-param.schema.ts
import { schema, rule } from '@aomex/common';

export const userIdParamSchema = schema({
  id: rule.uuid(),
});
```

```typescript
import { params } from '@aomex/web';
import { userIdParamSchema } from '../schemas/user-id-param.schema.js';

router.get('/users/:id', { // [!code focus:5]
  mount: [params(userIdParamSchema)], // [!code highlight]
  action: async (ctx) => {
    ctx.send(await findUser(ctx.params.id));
  },
});
```
`params()` 後 OpenAPI の path パラメータは自動で in: path、required。

## 次のステップ

- [クエリ文字列](/ja/web/query)
- [リクエストボディ](/ja/web/body)
- [インターフェースルーティング](/ja/web/router)：静的パスと :id の共存
