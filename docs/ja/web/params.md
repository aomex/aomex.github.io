---
outline: deep
---

# パスパラメータ

ルートを `/users/:id` のように書くと、一致したセグメントはまず**文字列**として `ctx.request.params` に入る。`mount` の `params()` で型と範囲を検証し、業務ではクリーンな `ctx.params` を使う。形が不正なら **400**、存在しなければ **404**。

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

`:id` が任意文字列にマッチしても合法 ID ではない——範囲・UUID はバリデータへ。形の誤りは **400**、未存在は **404**。監視で typo を欠落リソースと混同しない。

`params({ id: rule.int().min(1) })` のあと `ctx.params.id` は number。ルートテンプレート `:userId` と schema キー `userId` は一致させる。`params()` なしは文字列のみ——`"42"` と `42` が業務で混ざりやすい。パスがルートにマッチしなければ `params()` は実行されず、それは 404 の話で検証 400 ではない。

ルートが `:userId` なのに `params({ id: ... })` だとキー不一致。`query` で id を重複させて query を正としない——パスと query がずれるとキャッシュ・権限・ログが壊れる。

## UUID と複数セグメント

外部 ID が UUID のときは `rule.uuid()`。`/users/:userId/posts/:postId` のように複数プレースホルダは**同じ** `params({ ... })` にすべてのキーを宣言し、キー名はルートテンプレートと一致。

UUID を公開するリソース：

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

`:id` が複数ルートに繰り返すときは `params` 形状を schema ファイルへ。[body / query の再利用](/ja/web/body) と同じ。int → uuid など ID 規則の変更は schema 一箇所。

```typescript
// src/schemas/user-id-param.schema.ts
import { schema, rule } from '@aomex/common';

export const userIdParamSchema = schema({
  id: rule.uuid(),
});
```

```typescript
import { params } from '@aomex/web';
import { userIdParamSchema } from '@/schemas/user-id-param.schema';

router.get('/users/:id', { // [!code focus:5]
  mount: [params(userIdParamSchema)], // [!code highlight]
  action: async (ctx) => {
    ctx.send(await findUser(ctx.params.id));
  },
});
```

`params()` 後、OpenAPI の path パラメータは自動で `in: path` かつ `required`。

## 次のステップ

- [クエリ文字列](/ja/web/query)
- [リクエストボディ](/ja/web/body)
- [ルート](/ja/web/router)：静的パスと `:id` の共存