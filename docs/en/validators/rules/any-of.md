---
outline: deep
---

# rule.anyOf()

**At least one** branch must pass; multiple matches still succeed (login: email or employee id; search `q`: UUID or slug).

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only.

```typescript
import { rule, schema } from '@aomex/common';

export const loginSchema = schema({
  account: rule.anyOf([ // [!code highlight]
    rule.email(),
    rule.string().match(/^@[a-z0-9_-]+$/i),
  ]).required(),
});
```

- Infers as a **union** of branch types—wider than a single `string`.
- No rule-specific chain; chain each sub-rule on its own.
- Need **exactly one** match? Use [oneOf](./one-of)—overlap fails `oneOf` but usually still passes `anyOf`.

For shared chains see [Common chains](../chain); see also [oneOf](./one-of), [allOf](./all-of), [email](./email), [string](./string).