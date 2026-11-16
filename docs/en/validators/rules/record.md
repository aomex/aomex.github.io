---
outline: deep
---

# rule.record()

Models **`Record<string, V>`**: feature flags, i18n copy, tag→weight maps—arbitrary keys, uniform value type.

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only.

```typescript
import { rule, schema } from '@aomex/common';

export const flagsSchema = schema({
  features: rule.record(rule.boolean()), // [!code highlight]
});
// { darkMode: true, beta: false } → pass
```

- Same as `rule.object().additional({ value })`; infers as any string key + fixed value type.
- Put `min` / `optional` on the **value** rule, not on `record` itself.
- No rule-specific chain; `optional` / `default` see [Common chains](../chain).

For shared chains see [Common chains](../chain); see also [object](./object), [any](./any), [boolean](./boolean).