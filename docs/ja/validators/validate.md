---
outline: deep
---

# 手動バリデーション

**Web ルート以外**で、任意データをルールに照らして検証する：単体テスト、スクリプト、自作ミドルウェア。Web で body() / query() を載せるときの土台も同じ；ここは自分で `validate` を呼ぶ入口。

```typescript
import { validate } from '@aomex/common';
import { createUserSchema } from '../schemas/user.schema.js';

const input = { name: 'Ada', email: 'ada@example.com' };

const user = await validate(input, createUserSchema); // [!code highlight]
// 通过：user 已是 Infer 后的类型
// 失败：抛错（默认行为）
```

ルートで `mount: [body(createUserSchema)]` は同じ「通らなければ中断」の形で、エラーだけ HTTP 400 にまとまる。

validate は形状だけ；在庫、権限、重複登録は service / action のまま。

validate は Promise を返す；await を忘れると Promise を結果として使ってしまう。

- 第 1 引数は広い型（設定、unknown、テストフィクスチャ）；成功後は `Validator.Infer<typeof schema>` に狭まる。
- デフォルト throwOnError: true：失敗時は**使える戻り値はなく**、catch かバブルアップ。
- `{ throwOnError: false }` のとき `{ data, errors }`；**成功は `errors === null`** を見る。 `data === null` で判断しない——nullable() 時は合法値が null になり得る。

::: warning
`data === null` で失敗判定すると誤判定：nullable() 通過時に data が null のことがある。
:::

- 失敗かつ `throwOnError: false` のとき errors はだいたい `string[]`；フォームの複数項目エラーをまとめて返すのに向く。

| 書き方 | いつ使うか |
| --- | --- |
| `await validate(input, schema)` | スクリプト、単体テスト、ミドルウェア——失敗で停止 |
| `validate(input, schema, { throwOnError: false })` | 管理画面フォームで**全**エラーを一度に表示 |
| 同じ `schema` + `validate` / `body()` | ルールを 1 箇所で保守 |

### 例外を投げない：全エラーを集める

```typescript
import { validate } from '@aomex/common';
import { createUserSchema } from '../schemas/user.schema.js';

const input = { name: '', email: 'not-email' };

const result = await validate(input, createUserSchema, { throwOnError: false }); // [!code highlight]

if (result.errors === null) {
  await db.user.create(result.data);
} else {
  return { ok: false, errors: result.errors };
}
```

### ルートとの分担

**HTTP 入口**は body / query / params；**設定読み込み、Cron 前チェック、テストデータ**は validate。ルールは `src/schemas/` に置く。

Web API 全体で validate を手書きして throw(400) は重複し OpenAPI も散らかる——ミドルウェアで載せられるならそちら。

## 次のステップ

- [schema](./schema)
- [共通チェーン](./chain)（フィールド上で形状を狭める）
- [エラー形式](/ja/web/errors)（Web で例外後の JSON エンベロープ）
