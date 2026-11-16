---
outline: deep
---

# バリデーター

外から渡されるデータを、信用できるオブジェクトにまとめる：実行時に不正データを止め、TypeScript の型も狭める。Web の body() / query()、Console の options()、OpenAPI は通常**同じ rule セット**を共有し、interface の二重管理を減らす。

```typescript
import { rule, validate, schema, type Validator } from '@aomex/common';
```

```typescript
import { rule, validate } from '@aomex/common';

const input = { name: '  Ada  ', age: '18', hack: true };

const user = await validate(input, { // [!code highlight]
  name: rule.string().trim().length({ min: 1, max: 32 }),
  age: rule.int().min(0).optional(),
});

await doSomething(user);
```

user にホバーすると：

- name → string（trim 済み）
- age → number | undefined（'18' はだいたい数値に；optional）
- hack はない——宣言していないキーはデフォルトで捨てられる

ルートでは `body({ ... })` を載せると、ctx.body が直接狭まった型になり、手書き validate は不要になりがち。

::: tip
Zod 用と手書き interface を二重保守しない——フィールド変更でズレやすい。ここでは 1 つの rule で実行時と型の両方を担う。
:::

## プロジェクトでの選び方

| やりたいこと | 使うもの |
| --- | --- |
| 単一フィールド | `rule.string()` / `rule.int()` … → [バリデーター一覧](./builtins) |
| 複数フィールドの再利用 / PATCH 派生 | [`schema`](./schema)，`src/schemas/xxx.schema.ts` に置く |
| スクリプト / テストで一度検証 | [手動バリデーション](./validate) |
| ネスト、配列、いずれか一方 | [object](./rules/object) / [array](./rules/array) / [oneOf](./rules/one-of) |
| 「渡されたか / デフォルト / ドキュメント注記」 | [共通チェーン](./chain) |

任意キーをそのまま透過するなら [rule.record()](./rules/record) で明示し、未宣言フィールドが自動保持されることは期待しない。

::: warning
rule.any() は動くが、型も OpenAPI も曖昧になる；過渡期なら可、外部 API に長く置かない。
:::

## このセクション

| ページ | いつ開くか |
| --- | --- |
| [バリデーター一覧](./builtins) | 具体的な `rule.xxx` を探す |
| [共通チェーン](./chain) | `optional` / `default` / `transform`… |
| [schema](./schema) | pick / omit / partial |
| [Prisma](/ja/plugins/prisma) | テーブルから検証を生成 |
| [手動バリデーション](./validate) | スクリプト / 単体テストで `validate` |
| [カスタムバリデーター](/ja/advanced/validator) | 組み込みが足りないとき（上級） |
