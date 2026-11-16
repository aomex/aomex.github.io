---
outline: deep
---

# rule.oneOf()

Input must match **exactly one** branch; if several pass, validation **fails** (discriminated unions, mutually exclusive payment methods).

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only.

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

- Infers as a **union** of branch output types.
- Sub-rules inside the combo keep their own `min` / `match` etc.; the combinator has no extra chain APIs.
- No combinator-level `default` / `strict` semantics; use `optional` / `nullable` / `transform` / `docs` as usual.

For shared chains see [Common chains](../chain); see also [anyOf](./any-of), [allOf](./all-of), [literal](./literal), [object](./object).