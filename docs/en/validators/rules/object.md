---
outline: deep
---

# rule.object()

Validates **named JSON objects**: `profile` in the body, nested field tables, embedding an existing schema into a larger shape.

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only.

```typescript
import { rule, schema } from '@aomex/common';

export const userBody = schema({
  id: rule.int(),
  profile: rule.object({ // [!code highlight]
    bio: rule.string().optional(),
  }),
});
// default allowlist: undeclared fields are stripped
```

By default extra keys are dropped—clients sending unknown fields will see them **silently removed**, not a 400.

- The field table sets the inferred shape; nest with `rule.object({...})` or bare `{ key: rule... }`.
- `additional()` keeps extra keys (optionally filtered), widening types.
- After `parseFromString`, the value is still an object type.

### additional()

**When to use:** webhooks forwarded verbatim, proxy passes extra keys into storage (still prefer allowlists when you can).

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).additional();
// { id: 1, traceId: 'x' } → both kept
```

### additional({ key?, value? })

**When to use:** only `meta_*` keys, extra values must be `string`, declared fields plus a homogeneous extension bag.

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).additional({ key: /^(meta|ext)_/ });
rule.object().additional({ value: rule.string() });
rule.object({ id: rule.int() }).additional({ value: rule.number() });
```

For dynamic keys with uniform values and no fixed schema, prefer [record](./record).

### parseFromString(is?: boolean)

**When to use:** form/query stuffs JSON in one string, e.g. `filter={"status":"on"}`.

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).parseFromString();
// '{"id":1}' → { id: 1 }
```

### strict(is?: boolean)

**When to use:** body is already an object; block plain strings unless you also enable `parseFromString(true)`.

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).strict();
```

Do not use empty `object()` for homogeneous dynamic keys—use [record](./record).

For shared chains see [Common chains](../chain); see also [record](./record), [array](./array), [oneOf](./one-of).