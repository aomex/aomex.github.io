---
outline: deep
---

# クエリ文字列

GET（や query 付きの他動詞）向けに `?page=1&keyword=` を宣言する：ルート `mount` に `query()`、[バリデータ](/ja/validators/) で型と範囲を縛る。通過後は `ctx.query`；失敗は自動 **400**、action に入らない。

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

`query()` 後、`ctx.query` は宣言したキーのみ。`default()` なら欠損でも型上は必須の数値/文字列（page は常に number）。`optional()` は `undefined` を含む。`mount` に `query()` がなければ `ctx.request.query` など広い型だけ——業務の信頼入力にしない。検証失敗は action 不入り **400**。

action で `Number(ctx.request.query.page)` を手書きしない——OpenAPI・検証エラー形式から外れ、型も絞られない。

## リスト schema の再利用

複数リスト API で `page` / `size` / `q` を共有するなら `src/schemas/*.schema.ts` に集約し、ルートで `query(listQuerySchema)`。上限や default の変更は一箇所、OpenAPI も同じ記述。

ページング / `q` 検索を共通化：

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
import { listQuerySchema } from '@/schemas/list-query.schema';

const router = new Router();

router.get('/users', { // [!code focus:6]
  mount: [query(listQuerySchema)], // [!code highlight]
  action: async (ctx) => {
    const { page, size, q } = ctx.query;
    ctx.send(await searchUsers({ page, size, q }));
  },
});
```

ソート列の列挙：

```typescript
sort: rule.enum(['name', 'createdAt'] as const).default('createdAt'),
```

OpenAPI の説明は rule またはルートへ：

```typescript
page: rule.int().min(1).docs({ description: 'ページ番号（1 から）' }),
```

## body / params との役割分担

入参の出所を混ぜない：**query** — フィルタ・ページング（冪等 GET）、**params** — パス上のリソース ID、**body** — 作成/更新のエンティティ。ずれるとキャッシュ・ログ・OpenAPI が実際の意味と一致しない。

| 出所 | 典型的用途 |
| --- | --- |
| **query** | フィルタ、ページング、ソート——冪等 GET |
| **params** | パス内のリソース ID |
| **body** | POST / PUT / PATCH のエンティティ |

大きな JSON フィルタを query に押し込むと URL が膨らみキャッシュキーが厄介——POST + `body()` に移すなら冪等 GET キャッシュは諦める。作成 POST なのに query に大 JSON は慣例にも反する。

::: tip
リスト画面のクライアントは追跡用パラメータを余計に送ることが多い。query を過度に strict にしたり余計な必須を足すと B2B 連携で 400 になりやすい。`default()` は型上デフォルトがあるが、アクセスログの生 URL に `?page=1` があるとは限らない。
:::

## 次のステップ

- [パスパラメータ](/ja/web/params)
- [リクエストボディ](/ja/web/body)
- [バリデータのチェーン](/ja/validators/chain)：default、optional、transform