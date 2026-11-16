---
outline: deep
---

# rule.uuid()

Validates **UUID strings** (with hyphens): path `:id`, `parentId`, event `correlationId`.

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only.

```typescript
import { rule, schema } from '@aomex/common';

export const paramsSchema = schema({
  id: rule.uuid('v4'), // [!code highlight]
});
// '550e8400-e29b-41d4-a716-446655440000' → pass
```

- Infers as `string` after validation.
- Factory accepts `v1`–`v8` or an array; without a version, common variants are accepted.
- Comparison is usually case-insensitive.

### match(pattern: RegExp)

**When to use:** rarely—UUID is already narrow; only when stacking a business prefix (most projects use a separate field).

```typescript
import { rule } from '@aomex/common';

rule.uuid('v4').match(/^550e8400-/);
```

For shared chains see [Common chains](../chain); see also [ulid](./ulid), [string](./string), [anyOf](./any-of).