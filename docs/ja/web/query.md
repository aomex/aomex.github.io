---
outline: deep
---

# クエリ文字列

GET などで `?page=1&keyword=` を宣言：ルート mount の `query()` と [バリデータ](/ja/validators/)。通過後 `ctx.query`。失敗は自動 **400**、action へ入らない。

```typescript
import { rule } from '@aomex/common';
import { query, Router } from '@aomex/web';

export const router = new Router();

router.get('/users', { // [!code focus:13]
  mount: [
    query({ // [!code highlight]
      page: rule.int().min(1).default(1),
      size: rule.int().min(5).max(50).default(10),
      keyword: rule.string().optional(),
    }),
  ],
  action: async (ctx) => {
    const { page, size, keyword } = ctx.query;
    ctx.send({ page, size, keyword, items: [] });
  },
});
```
例：GET /users?page=2&size=20&keyword=ada。

`query()` 後 `ctx.query` は宣言キーのみ。`default()` で欠損でも型上は必須の数値/文字列（page は常に number）。`optional()` は undefined 込み。mount に `query()` がなければ `ctx.request.query` など広い型のみ——業務で信頼データにしない。検証失敗は action 不入り **400**。

action で `Number(ctx.request.query.page)` を手書きしない——OpenAPI・検証エラー形式から外れ、型も絞られない。

## リスト schema 再利用

複数リスト API で `page` / `size` / `q` を共有するなら `src/schemas/*.schema.ts` に集約し `query(listQuerySchema)`。[body 再利用](/ja/web/body) と同じ。

```typescript
// src/schemas/list-query.schema.ts
import { schema, rule } from '@aomex/common';

export const listQuerySchema = schema({
  page: rule.int().min(1).default(1),
  size: rule.int().max(100).default(20),
  q: rule.string().trim().optional(),
});
```

```typescript
// src/routers/user.ts
import { query, Router } from '@aomex/web';
import { listQuerySchema } from '../schemas/list-query.schema.js';

const router = new Router();

router.get('/users', { // [!code focus:6]
  mount: [query(listQuerySchema)], // [!code highlight]
  action: async (ctx) => {
    const { page, size, q } = ctx.query;
    ctx.send(await searchUsers({ page, size, q }));
  },
});
```
列挙ソートフィールド：

```typescript
sort: rule.enum(['name', 'createdAt'] as const).default('createdAt'),
```
OpenAPI 説明は rule かルートへ：

```typescript
page: rule.int().min(1).docs({ description: '页码，从 1 起' }),
```
## body / params との役割分担

混ぜない：**query** はフィルタ・ページング（冪等 GET）、**params** はパス上のリソース ID、**body** は POST/PUT/PATCH のエンティティ。誤配置はキャッシュ・ログ・OpenAPI が実際の意味とずれる。

| ソース | 典型用途 |
| --- | --- |
| **query** | フィルタ、ページング、ソート——冪等 GET |
| **params** | パス上のリソース ID |
| **body** | POST / PUT / PATCH の本体 |

巨大 JSON フィルタを query に押し込むと URL が膨らみキャッシュキーが難しくなる——POST + `body()` に変更し、冪等 GET キャッシュを諦める代償を受け入れる。作成なのに query に大 JSON も慣例違反。

::: tip
リストクライアントは追跡用パラメータを余計に送ることがある。query を過度に strict / 余計な required にしないと B2B で 400 が多発。`default()` で型にデフォルトがあっても、アクセスログの生 URL に `?page=1` があるとは限らない。
:::

## 次のステップ

- [パスパラメータ](/ja/web/params)
- [リクエストボディ](/ja/web/body)
- [バリデータチェーン](/ja/validators/chain)：default、optional、transform
