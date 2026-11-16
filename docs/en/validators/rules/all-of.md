---
outline: deep
---

# rule.allOf()

Input must satisfy **every** rule in the array at once—good for reusing password fragments or API key format pieces across the team.

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only.

```typescript
import { rule, schema } from '@aomex/common';

const passwordBase = rule.string().length({ min: 8, max: 72 });
const passwordDigit = rule.string().match(/\d/);

export const registerSchema = schema({
  password: rule.allOf([passwordBase, passwordDigit]).required(), // [!code highlight]
});
// 'passw0rd!' → pass; 'short' → fail
```

- Infers as the **intersection** of branch outputs (often the same `string` with stacked constraints).
- No rule-specific chain.
- Chaining `.length().match()` on one field is often clearer; `allOf` shines when **reusing fragments across files**.

For shared chains see [Common chains](../chain); see also [string](./string), [anyOf](./any-of), [oneOf](./one-of).