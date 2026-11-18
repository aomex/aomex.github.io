---
outline: deep
---

# レスポンス制約

ルートに「返しうるステータスと成功体形状」を宣言：mount の `response()`。データの送り方は変えないが、`ctx.send` / `ctx.throw` / `ctx.redirect` の型を絞り OpenAPI に書く。200 宣言で send(201) するとコンパイルが赤くなる——意図的。

```typescript
import { rule } from '@aomex/common';
import { response, Router } from '@aomex/web';

export const router = new Router();

router.get('/me', { // [!code focus:19]
  mount: [
    response({ // [!code highlight]
      statusCode: 200,
      content: {
        id: rule.int(),
        name: rule.string(),
      },
    }),
    response({ statusCode: 404 }),
  ],
  action: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) {
      return ctx.throw(404, 'not found');
    }
    ctx.send({ id: user.id, name: user.name });
  },
});
```
欠損は throw(404)、成功は send——send(404) に混ぜない。`response()` はコンパイル期とドキュメント。実行時に send body を再検証しない。

200 content 宣言後 `ctx.send({ id, name })` はバリデータ推論と一致必須。`response({ statusCode: 404 })` のあと `ctx.throw(404, …)` が合法出口。**201** など非200の2xxは send で**明示ステータス**。**204** は `ctx.send(204)` で `{}` を足さない。**3xx** は `ctx.redirect(status, url)`。複数 `response()` で成功とエラー。

| ステータス | 典型の送り方 |
| --- | --- |
| `200` | `send(body)` または `send(200, body)` |
| その他 2xx | `send(status, body)` |
| 204 など body なし | `send(status)` |
| 3xx | `redirect(status, url)` |
| 4xx / 5xx | `throw(status, …)` |

## 作成 201

REST で新規成功は **201**、body に id 等。mount で `response({ statusCode: 201, content: ... })`、action で `ctx.send(201, body)` すると型と OpenAPI が 201 を合法出口にする。

```typescript
import { body } from '@aomex/web';

router.post('/users', { // [!code focus:15]
  mount: [
    body({
      name: rule.string().trim().length({ min: 1 }),
    }),
    response({ // [!code highlight]
      statusCode: 201,
      content: { id: rule.int(), name: rule.string() },
    }),
    response({ statusCode: 400 }),
  ],
  action: async (ctx) => {
    const user = await createUser(ctx.body);
    ctx.send(201, { id: user.id, name: user.name });
  },
});
```
## 削除成功 204

成功で JSON 不要なら **204 No Content**。`response({ statusCode: 204 })` のあと `ctx.send(204)`。204 に `{}` を入れない。

```typescript
import { params } from '@aomex/web';

router.delete('/users/:id', {
  mount: [
    params({ id: rule.int().min(1) }),
    response({ statusCode: 204 }), // [!code highlight]
    response({ statusCode: 404 }),
  ],
  action: async (ctx) => {
    const ok = await deleteUser(ctx.params.id);
    if (!ok) {
      return ctx.throw(404);
    }
    ctx.send(204);
  },
});
```
## リダイレクト 3xx

短縮 URL、ログイン後、旧 URL 移行は **3xx**。`ctx.redirect(status, url)` で Location を手書きしない。mount に `response({ statusCode: 302 })` 等で redirect が合法出口に。

```typescript
router.get('/go', {
  mount: [
    response({ statusCode: 302 }), // [!code highlight]
  ],
  action: async (ctx) => {
    ctx.redirect(302, 'https://example.com');
  },
});
```
## ページングリストエンベロープ

リスト 200 で `{ total, items }` 固定。[query()](/ja/web/query) とページング入力を揃える。

```typescript
import { query } from '@aomex/web';

router.get('/users', { // [!code focus:22]
  mount: [
    query({
      page: rule.int().min(1).default(1),
      size: rule.int().min(1).max(50).default(20),
    }),
    response({ // [!code highlight]
      statusCode: 200,
      content: {
        total: rule.int(),
        items: rule.array({
          id: rule.int(),
          name: rule.string(),
        }),
      },
    }),
  ],
  action: async (ctx) => {
    const { page, size } = ctx.query;
    const { total, items } = await listUsers({ page, size });
    ctx.send({ total, items });
  },
});
```
検証系 400 だけ掛け、フィールド形状を書かないとき本文はグローバル formatError に揃うことが多い：

```typescript
response({ statusCode: 400 }),
```
SSE、プレーンテキスト等特殊メディア：

```typescript
response({
  statusCode: 200,
  contentType: 'text/event-stream', // [!code highlight]
  content: rule.string(),
}),
```

## レスポンスラップのスキップ

サイト全体で [envelope](/ja/web/envelope) を有効にしているとき、特定のステータスだけ**裸で書き出す**なら、該当 `response()` に `skipEnvelope: true` を付ける。この宣言の `statusCode` だけ影響し、同ルートの他ステータスは従来どおりラップ。実行時と OpenAPI の両方に登録される。

```typescript
router.get('/report.pdf', { // [!code focus:12]
  mount: [
    response({
      statusCode: 200,
      contentType: 'application/pdf',
      content: rule.string(),
      skipEnvelope: true, // [!code highlight]
    }),
    response({ statusCode: 404 }),
  ],
  action: async (ctx) => {
    ctx.send(await loadPdf());
  },
});
```

ドキュメントページや裸の OpenAPI JSON といったインフラ出口は、action 内で `ctx.response.skipEnvelope = true`（今回の書き出しを無条件スキップ）も使える。業務ルートは上記オプションを優先し、ドキュメント漏れを避ける。

`response()` なしでも send 可。本番前に成功態とよくある 400/404 を足し、OpenAPI と型のレスポンスが空洞にならないように。200 宣言で action が `send(201)` すると型エラー——ステータスか `response()` を直す。

## 次のステップ

- [エラー形式](/ja/web/errors)（4xx/5xx JSON と response）
- [レスポンスエンベロープ](/ja/web/envelope)（外側固定 200・`skipEnvelope`）
- [リクエストボディ](/ja/web/body) / [クエリ](/ja/web/query)
- [OpenAPI 生成](/ja/plugins/openapi)
