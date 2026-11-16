---
outline: deep
---

# rule.oneOf()

入力がルール配列の **ちょうど 1 つだけ** に合致することを要求する。複数に合う場合も失敗（判別共用体、排他的な支払い方法）。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { rule, schema } from '@aomex/common';

export const payMethodSchema = schema({
  method: rule.oneOf([ // [!code highlight]
    rule.object({
      type: rule.literal('card'),
      last4: rule.string().length(4),
    }),
    rule.object({
      type: rule.literal('balance'),
      amount: rule.decimal().min('0.01'),
    }),
  ]),
});
```

- 各ブランチの出力型の **ユニオン** として推論される。
- 組み合わせ内の子ルールはそれぞれ min / match などを持つ；組み合わせレベルの専用チェーンはない。
- 組み合わせレベルの default / strict の専用意味はない；optional / nullable / transform / docs は使える。

共通チェーンは [共通チェーン](../chain)；[anyOf](./any-of)、[allOf](./all-of)、[literal](./literal)、[object](./object)。
