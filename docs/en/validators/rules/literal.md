---
outline: deep
---

# rule.literal()

Value must **equal exactly** a fixed literal: webhook `event`, discriminated `type`, fixed `action: 'ping'`.

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only.

```typescript
import { rule, schema } from '@aomex/common';

export const pingSchema = schema({
  action: rule.literal('ping'), // [!code highlight]
});
// { action: 'ping' } → pass; 'pong' → fail; '1' and 1 are not equal
```

- Narrows inference to the literal type (e.g. `'ping'`).
- No coercion—`'1'` and `1` are different branches.
- No rule-specific chain; `optional` / `default` see [Common chains](../chain).

For shared chains see [Common chains](../chain); see also [enum](./enum), [oneOf](./one-of), [anyOf](./any-of).