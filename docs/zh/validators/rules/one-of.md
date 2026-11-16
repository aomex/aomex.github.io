---
outline: deep
---

# rule.oneOf()

入参必须 **恰好命中一种** 规则；多种都能过也算失败（判别联合、互斥支付方式）。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。

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

- 推断为各分支输出类型的 **联合**。
- 组合内子规则仍各自带 min / match 等；本组合无专属链。
- 无 default / strict 的组合级专属语义；可用 optional / nullable / transform / docs。

通用链见 [通用链式](../chain)；[anyOf](./any-of)、[allOf](./all-of)、[literal](./literal)、[object](./object)。
