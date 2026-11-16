---
outline: deep
---

# リクエストボディ

POST / PUT / PATCH の JSON やフォーム本文を mount の `body()` とバリデータで宣言。通過後 `ctx.body` の型が絞られる。形が違うと **400**、大きすぎると **413**（[Web アプリケーション入口](/ja/web/) の body.payload / body.formData で調整）。

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
よくある Content-Type：application/json、application/x-www-form-urlencoded、text/*。`rule.file()` があると multipart/form-data。

`body({ username: rule.string(), age: rule.int().optional() })` のあと `ctx.body.username` は string、age は number | undefined。`body(createPostSchema.partial())` は PATCH で各フィールド optional だがルールは POST と共用。ルート `body(rule.array(...))` や `body(rule.oneOf([...]))` なら `ctx.body` は配列全体かユニオン。`body()` なしで `ctx.body` を検証済み入力にしない。

自前で req ストリームを JSON.parse しない——フレームワーク解析済み `ctx.body` と衝突し、クォータもバラける。

## アプリ級 JSON 上限

`WebApp.body.payload.maxSize` は**サイト全体**の JSON/テキスト体上限。巨大ボディは `body()` 検証前に拒否され **413**。公開 API・webhook でメモリを守るときはここ。ルート schema では「そもそも読み切れない」サイズは防げない。

公開 API / webhook で巨大ボディ防止：

```typescript
new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  body: { // [!code focus:3]
    payload: { maxSize: '1mb' }, // [!code highlight]
  },
  mount: [routers('./src/routers')],
});
```
## ルート配列ボディ

クライアントが**ルートを配列 JSON** にする（ID バッチ、イベントリスト）場合、`{ items: [...] }` ではなく `body(rule.array(...))` や schema 全体を渡すと `ctx.body` は配列型。

バッチ ID、webhook 配列体：

```typescript
router.post('/batch-delete', {
  mount: [body(rule.array(rule.int()))], // [!code highlight]
  action: async (ctx) => {
    ctx.send({ deleted: ctx.body.length });
  },
});
```
## oneOf 排他形状

同一 URL に `type` 分岐など複数 JSON 形状があり、同時に一つだけマッチさせたい。`rule.oneOf([...])` は順に試し、ちょうど1つ成功で合法。2つ通る/どれもダメは **400**。

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

作成は完全 schema、部分更新は同 schema の `.partial()`：PATCH で各フィールド optional、ルールは POST と共有。`src/schemas/*.schema.ts` に寄せればルートは1定義参照。フィールド変更を二箇所で揃える必要がなくなる。

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
import { createPostSchema } from '../schemas/post.schema.js';

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
`partial()` では空オブジェクト `{}` も通る——「最低1フィールド必須」なら action で追加判定。クライアントが Content-Type を忘れると空 body が `{}` 扱いになり、全部 optional だと「何も変更なし」で黙って通る。
:::

## ファイル付き

アバター・添付は `rule.file()`。[ファイルアップロード](/ja/web/attach) 参照：

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
| `{ avatar: rule.file() }` | 単一ファイル。フィールド名 = フォーム name |
| `{ photos: rule.array(rule.file()).length({ max: 5 }) }` | 同名複数 part、最大5 |
| ネストに `rule.file()` | multipart 平坦名と合わないことが多い |

フィールド maxSize とアプリ formData は**厳しい方**。413 は両層。

巨大フィルタを POST + `body()` に移すなら、ドキュメントとキャッシュ方針を明記。GET 冪等の約束のままにしない。

## 次のステップ

- [ファイルアップロード](/ja/web/attach)
- [レスポンス制約](/ja/web/response)
- [Web アプリケーション入口](/ja/web/)：body サイトクォータ
