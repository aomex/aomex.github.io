---
outline: deep
---

# rule.oneOf()

入參必須 **恰好命中一種** 規則；多種都能過也算失敗（判別聯合、互斥支付方式）。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

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

- 推斷為各分支輸出型別的 **聯合**。
- 組合內子規則仍各自帶 min / match 等；本組合無專屬鏈。
- 無 default / strict 的組合級專屬語義；可用 optional / nullable / transform / docs。

通用鏈見 [通用鏈式](../chain)；[anyOf](./any-of)、[allOf](./all-of)、[literal](./literal)、[object](./object)。
