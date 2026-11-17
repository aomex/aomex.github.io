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

- An array argument infers as a union of literals (e.g. `'asc' | 'desc'`).
- `pick` / `omit` yield a new enum validator, often keeping `optional` / `default`.
- Empty `pick` / `omit` or `default` outside the set throws at configuration time.

When you already have a TypeScript `enum` (or an `as const` enum-like object), pass it straight to `rule.enum`—no need to copy the values into a separate array:

```typescript
import { rule, schema } from '@aomex/common';

enum Color {
  Red = 'red',
  Blue = 'blue',
}

export const patchBody = schema({
  color: rule.enum(Color), // [!code highlight]
});
// { color: 'red' } → Color.Red; 'green' → fail
```

The inferred type is the enum member type (`Color`), not a bare `'red' | 'blue'`—so `ctx.body.color` compares cleanly with `Color.Red`. Numeric enums work the same way and infer as `Status`:

```typescript
import { rule } from '@aomex/common';

enum Status {
  Off = 0,
  On = 1,
}

rule.enum(Status); // → Status
```

Without the `enum` keyword, use a const object and pass that; the inferred type is the value union:

```typescript
import { rule } from '@aomex/common';

const Role = { Admin: 'admin', User: 'user' } as const;

rule.enum(Role); // → 'admin' | 'user'
```

Object values must be string / number; for booleans use the array form `rule.enum([true, false])`.

### pick(...values | values[])

**When to use:** full status set for admin; user publish API only `draft` → `published`.

```typescript
import { rule } from '@aomex/common';

const status = rule.enum(['draft', 'published', 'archived']);
status.pick('draft', 'published');
status.pick(['draft', 'published']);
```

With a TS enum, pick / omit take members: `rule.enum(Color).pick(Color.Red, Color.Blue)`.

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
