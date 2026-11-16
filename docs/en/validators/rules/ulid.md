---
outline: deep
---

# rule.ulid()

Validates **ULID** strings (26 characters, roughly time-ordered): orderId, sync cursors like `after`.

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only.

```typescript
import { rule, schema } from '@aomex/common';

export const orderParams = schema({
  orderId: rule.ulid().required(), // [!code highlight]
});
// '01ARZ3NDEKTSV4RRFFQ69G5FAV' → pass
```

- Infers as `string` after validation.
- No factory options such as version; optional/default behavior uses [Common chains](../chain).

For shared chains see [Common chains](../chain); see also [uuid](./uuid), [int](./int), [bigint](./bigint).