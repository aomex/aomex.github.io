---
outline: deep
---

# リクエストボディ

POST / PUT / PATCH の JSON やフォーム本文を定義する：`mount` に `body()` を掛け、バリデータでフィールドを記述する。通過後は `ctx.body` の型が絞られる。形状が合わなければ **400**、サイズ超過なら **413**（[Web アプリ入口](/ja/web/) の `body.payload` / `body.formData` を参照）。

```typescript
import { rule } from '@aomex/common';
import { body, Router } from '@aomex/web';

export const router = new Router();

router.post('/users', { // [!code focus:13]
  mount: [
    body({ // [!code highlight]
      username: rule.string().length({ min: 2, max: 32 }),
      age: rule.int().min(0).max(150).optional(),
    }),
  ],
  action: async (ctx) => {
    const { username, age } = ctx.body;
    ctx.send(201, { username, age });
  },
});
```

よくある Content-Type：`application/json`、`application/x-www-form-urlencoded`、`text/*`。`rule.file()` があるときは `multipart/form-data` でパースされる。

`body({ username: rule.string(), age: rule.int().optional() })` のあと、`ctx.body.username` は string、`age` は `number | undefined`。PATCH では `body(createPostSchema.partial())` で各フィールドが optional になり、ルールは POST と共有。ルート直下で `body(rule.array(...))` や `body(rule.oneOf([...]))` なら、`ctx.body` は配列全体かユニオン型。`body()` を掛けていないのに `ctx.body` を検証済み入力として使わない。

`req` を自前で読んで `JSON.parse` しない——フレームワークが既にパースした `ctx.body` と衝突し、クォータも揃わない。

## アプリ全体の JSON 上限

`WebApp.body.payload.maxSize` は**サイト全体**の JSON / テキストボディサイズを制限する。大きすぎるリクエストは `body()` 検証の前に拒否され **413** になる。公開 API や公網 webhook でメモリを守るときはここで上限を設定する。ルートレベルの schema では「そもそもパースできない」ケースは止められない。

公開 API / webhook で大きなボディを防ぐ：

```typescript
import { logger } from '@/services/logger.service';

new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  body: { // [!code focus:3]
    payload: { maxSize: '1mb' }, // [!code highlight]
  },
  mount: [routers('./src/routers')],
});
```

## ルートが配列のボディ

クライアントが `{ items: [...] }` ではなく**ルート JSON を配列**で送ることもある（一括 ID、イベント一覧）。`body()` に `rule.array(...)` やスキーマ全体を渡すと、通過後 `ctx.body` は配列型になる。

一括 ID・webhook の配列ボディ：

```typescript
router.post('/batch-delete', {
  mount: [body(rule.array(rule.int()))], // [!code highlight]
  action: async (ctx) => {
    ctx.send({ deleted: ctx.body.length });
  },
});
```

## oneOf で排他的な形状

同一 URL に `type` で分岐する複数 JSON が来るが、常にどれかひとつだけ一致させたいとき、`rule.oneOf([...])` が各候補を順に試し、ちょうど一つだけ通れば合法。二つ通る・どれもダメなら **400**。

```typescript
router.post('/events', { // [!code focus:13]
  mount: [
    body( // [!code highlight]
      rule.oneOf([
        rule.object({ type: rule.literal('a'), a: rule.int() }),
        rule.object({ type: rule.literal('b'), b: rule.string() }),
      ]),
    ),
  ],
  action: async (ctx) => {
    ctx.send({ ok: true });
  },
});
```

## 作成と PATCH

作成は完全な schema、部分更新は同じ schema の `.partial()`：PATCH では各フィールドが optional になり、ルールは POST と共有。`src/schemas/*.schema.ts` に切り出せば、ルートは定義を一箇所参照するだけで、フィールド変更を二重メンテしない。

```typescript
// src/schemas/post.schema.ts
import { schema, rule } from '@aomex/common';

export const createPostSchema = schema({
  title: rule.string(),
  content: rule.string(),
});
```

```typescript
import { body } from '@aomex/web';
import { createPostSchema } from '@/schemas/post.schema';

router.post('/posts', { // [!code focus:6]
  mount: [body(createPostSchema)], // [!code highlight]
  action: async (ctx) => {
    ctx.send(201, await createPost(ctx.body));
  },
});

router.patch('/posts/:id', {
  mount: [body(createPostSchema.partial())], // [!code highlight]
  action: async (ctx) => {
    ctx.send(await patchPost(ctx.params.id, ctx.body));
  },
});
```

::: warning
`partial()` では空オブジェクト `{}` も検証を通る——「少なくとも一フィールド必須」なら action で追加判定する。クライアントが Content-Type を忘れると空 body が `{}` 扱いになり、すべて optional だと何も更新していないのに通ってしまう。
:::

## ファイル付き

アバター・添付は `rule.file()`。詳細は [ファイルアップロード](/ja/web/attach)：

```typescript
router.post('/avatar', { // [!code focus:12]
  mount: [
    body({
      name: rule.string(),
      avatar: rule.file().maxSize('2mb').mimeTypes('image/*'), // [!code highlight]
    }),
  ],
  action: async (ctx) => {
    const { avatar } = ctx.body;
    await saveAvatar(avatar);
    ctx.send({ ok: true });
  },
});
```

| 書き方 | 結果 |
| --- | --- |
| `{ avatar: rule.file() }` | 単一ファイル。フィールド名 = フォームの name |
| `{ photos: rule.array(rule.file()).length({ max: 5 }) }` | 同名フィールドで複数 part、最大 5 個 |
| ネストオブジェクト内の `rule.file()` | multipart のフラットなフィールド名と合わないことが多い |

フィールドごとの `maxSize` とアプリの formData は**より厳しい方**が効く。413 のときは両方の設定を確認する。

大きなフィルタ条件を POST + `body()` に移すなら、ドキュメントとキャッシュ方針を GET のままと誤解させないこと。

## 次のステップ

- [ファイルアップロード](/ja/web/attach)
- [レスポンスの制約](/ja/web/response)
- [Web アプリ入口](/ja/web/)：ボディのサイト全体クォータ