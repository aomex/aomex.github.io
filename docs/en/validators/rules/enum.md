---
outline: deep
---

# rule.enum()

Restricts a field to a **finite set**: `status`, `sort`, `role` (shows up in OpenAPI `enum`).

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only.

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  sort: rule.enum(['asc', 'desc']).default('desc'), // [!code highlight]
});
// ?sort=asc → 'asc'; invalid → fail
```

- Infers as a union of literals or enum members (when you pass a TS enum).
- `pick` / `omit` yield a new enum validator, often keeping `optional` / `default`.
- Empty `pick` / `omit` or `default` outside the set throws at configuration time.

### pick(...values | values[])

**When to use:** full status set for admin; user publish API only `draft` → `published`.

```typescript
import { rule } from '@aomex/common';

const status = rule.enum(['draft', 'published', 'archived']);
status.pick('draft', 'published');
status.pick(['draft', 'published']);
```

### omit(...values | values[])

**When to use:** create cannot pick `archived`; filter dropdown hides internal states.

```typescript
import { rule } from '@aomex/common';

rule.enum(['draft', 'published', 'archived']).omit('archived');
```

After changing `default`, ensure it still lies in the post-`pick`/`omit` set.

### strict(is?: boolean)

**When to use:** numeric enums when the body is already `number`; query strings usually stay non-strict.

```typescript
import { rule } from '@aomex/common';

rule.enum([0, 1, 2]).strict();
// '1' → fail; 1 → pass
```

For shared chains see [Common chains](../chain); see also [literal](./literal), [oneOf](./one-of), [string](./string).