---
outline: deep
---

# rule.boolean()

Coerces switch-like input to **boolean**: publish flags, `?featured=1`, JSON `isAdmin`.

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only.

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  published: rule.boolean().default(false), // [!code highlight]
});
// ?published=1 → true; omit → false
```

- Infers as `boolean` after validation.
- Default truthy/falsy literals (e.g. `'true'`, `1`) map to booleans; after you customize lists, only listed values pass.
- With `default(false)`, the field is still typed as `boolean` when missing.

Default truthy: `1` / `'1'` / `true` / `'true'`; falsy: `0` / `'0'` / `false` / `'false'`. Tri-state UI (unset / yes / no) should not be forced into `boolean`—use `optional()` or a separate enum field.

### setTruthyValues(values: any[])

**Replaces** the default truthy list (does not append).

**When to use:** legacy systems or HTML forms submit `yes` / `on` / `Y` instead of `true`.

```typescript
import { rule } from '@aomex/common';

rule.boolean().setTruthyValues(['yes', 'on', 'Y', 1, true]);
// 'on' → true; after override default 'true' may no longer match
```

Changing only `setTruthyValues` without updating falsy values can leave switches stuck on or middle states returning 400.

### setFalsyValues(values: any[])

**Replaces** the default falsy list.

**When to use:** pair with truthy list when the client sends `no` / `off` for off.

```typescript
import { rule } from '@aomex/common';

rule.boolean()
  .setTruthyValues(['yes', 'on', 1, true])
  .setFalsyValues(['no', 'off', 0, false]);
```

Values outside both lists fail; there is no `strict()`—tightness is entirely your lists.

For shared chains see [Common chains](../chain); multi-state fields see [enum](./enum); plain text toggles see [string](./string).