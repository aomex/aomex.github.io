---
outline: deep
---

# rule.stream()

Validates a **readable stream** (Node `Readable`): export job sources, subprocess stdout, internal job pipes—not JSON body fields.

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only.

```typescript
import { Readable } from 'node:stream';
import { rule, schema } from '@aomex/common';

export const exportSchema = schema({
  format: rule.literal('csv'),
  source: rule.stream().required(), // [!code highlight]
});
// Readable.from([...]) → pass; { foo: 1 } → fail
```

- Narrows to a readable stream type after validation (see `Validator.Infer`).
- No rule-specific chain; `optional` / `required` see [Common chains](../chain).
- JSON deserialization never yields a real stream—do not expect this on HTTP JSON routes.

For shared chains see [Common chains](../chain); see also [file](./file), [buffer](./buffer), [literal](./literal).