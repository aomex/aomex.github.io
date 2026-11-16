---
outline: deep
---

# rule.any()

JSON fragments **without a fixed shape yet**: plugin `settings`, audit `before`/`after`, unknown fields during migration.

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only.

```typescript
import { rule, schema } from '@aomex/common';

export const pluginSchema = schema({
  name: rule.string().required(),
  settings: rule.any().optional(), // [!code highlight]
});
// settings may be object, array, string, number, etc.—typical JSON shapes
```

- Inference stays very wide (near `unknown` / a broad union—follow the compiler).
- You often still narrow or re-validate when reading `ctx.body`.
- No rule-specific chain methods.

Prefer [object](./object) / [record](./record) when you can model the shape; use `rule.any()` for third-party blobs or admin JSON during transition. Long-term bare `any` weakens OpenAPI and TS—tighten the schema when migration ends. For arbitrary keys with homogeneous values use [record](./record), not `any`.

For shared chains see [Common chains](../chain); structured alternatives: [record](./record), [oneOf](./one-of), [object](./object).