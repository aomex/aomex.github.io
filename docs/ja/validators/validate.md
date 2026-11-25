---
outline: deep
---

# 手動検証

**Web ルート以外**で任意データを規則に照らす：単体テスト、スクリプト、自作ミドルウェア。Web で body() / query() を掛けるときも同じ仕組み；ここは自前で `validate` を呼ぶ入口。

```typescript
import { validate } from '@aomex/common';
import { createUserSchema } from '@/schemas/user.schema';

const input = { name: 'Ada', email: 'ada@example.com' };

const user = await validate(input, createUserSchema); // [!code highlight]
// 成功：user は Infer 後の型
// 失敗：throw（デフォルト）
```

ルートの `mount: [body(createUserSchema)]` は同じ「不合格で中断」だが、エラーは HTTP 400 にまとまる。

validate は形状だけ；在庫・権限・重複登録は service / action。

validate は Promise。await 忘れで Promise を結果に使う。

- 第一引数は広い型（設定、unknown、テストフィクスチャ）。成功後は `Validator.Infer<typeof schema>` に狭る。
- デフォルト throwOnError: true：失敗時は戻り値なし、catch またはバブル。
- `{ throwOnError: false }` では `{ data, errors }`；**成功は `errors === null`**。`data === null` で失敗判定しない——nullable() で合法 null があり得る。

::: warning
`data === null` で失敗判定すると誤判定：nullable() 通過時 data が null のことがある。
:::

- 失敗かつ `throwOnError: false` では errors はだいたい `string[]`。フォームへ一括表示向き。

| 書き方 | いつ |
| --- | --- |
| `await validate(input, schema)` | スクリプト、単体、ミドルウェア——失敗で停止 |
| `validate(input, schema, { throwOnError: false })` | 管理画面フォーム——**全**エラーを一度に |
| 同じ `schema` + validate / body() | 規則は一箇所 |

### throw しない：全エラー収集

```typescript
import { validate } from '@aomex/common';
import { createUserSchema } from '@/schemas/user.schema';

const input = { name: '', email: 'not-email' };

const result = await validate(input, createUserSchema, { throwOnError: false }); // [!code highlight]

if (result.errors === null) {
  await db.user.create(result.data);
} else {
  return { ok: false, errors: result.errors };
}
```

### ルートとの分担

**HTTP 入口**は body / query / params；**設定読み、Cron 前チェック、単体データ**は validate。規則は `src/schemas/` に集約。

Web API 到处に validate + throw(400) は重複し OpenAPI も散らかす——ミドルウェアが掛けられるなら掛ける。

## 次に

- [schema](./schema)
- [共通チェーン](./chain)（フィールド上で形状を狭める）
- [エラー形式](/ja/web/errors)（Web で throw 後の JSON envelope）