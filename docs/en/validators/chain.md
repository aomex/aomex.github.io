---
outline: deep
---

# Common chains

Attach **shared chains** on any `rule.xxx()` for presence, nullability, defaults, strictness, transforms, and docs. Orthogonal to factory-specific methods like `trim` and `min`—see dedicated pages in [Validator list](./builtins).

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  page: rule.int().min(1).default(1),
  q: rule.string().trim().optional(),
});

// GET ?page=2&q=ada  → { page: 2, q: 'Ada' } (with transform)
// GET omit page     → { page: 1, q: undefined }
```

Default pagination plus optional search is the combo you wire first in most projects.

- After `optional()`, inference is often `T | undefined`; after `default(...)`, the field is usually always present—missing input gets the default.
- `nullable()` allows JSON `null` separately from “missing”; PATCH clears with `null`, not `undefined`.
- With `strict()`, string `'18'` often fails `rule.int()`; query is almost always strings—**usually avoid strict on query**.
- `transform(fn)` replaces the field type with the return type—after `rule.string().transform(...)` inference follows the transform output, not `string`.
- `docs(...)` does **not** change runtime types—only OpenAPI metadata.

Some combinators or `file` may lack `default` / `strict`—check the dedicated page.

Each method below has “when to use” plus a copy-paste demo; typical order: type constraints, then `default` / `optional`, then `transform` and `docs`.

### optional()

Field may be absent. `undefined` and default empty string `''` are often treated as empty—with `optional`, validation passes and value is `undefined`.

**When to use:** list filters, PATCH partial updates, optional Console flags.

```typescript
import { rule } from '@aomex/common';

// GET /users?q=ada — q may be omitted entirely
rule.string().trim().optional();
```

When you already have [default(...)](#defaultvalue--value), you usually skip `optional()`—default is enough. For strings where empty string counts as a value, use [allowEmptyString()](./rules/string).

### required()

Reverse of `optional()`—tighten back to required.

**When to use:** after draft `partial()` on a schema, formal submit tightens again.

```typescript
import { rule } from '@aomex/common';

const title = rule.string().optional();
title.required();
```

With an existing `default(...)`, calling `required()` **usually does not** remove the default—missing input still gets the default.

### nullable()

Allow JSON `null`, separate from “not sent”.

**When to use:** PATCH “send `null` to clear, omit to leave unchanged”.

```typescript
import { rule } from '@aomex/common';

rule.string().nullable().optional();
// null → clear; omit → undefined, skip field in business logic

rule.int().nullable();
```

Without `nullable`, `null` may be treated as empty—follow type hints.

For PATCH clears use `nullable()` + `null`; for “no change” use omit → `undefined`—do not rely on `optional()` alone to separate them.

### default(value | () => value)

When missing or empty, use the default; field becomes non-required; the default value **usually skips** re-validation.

**When to use:** pagination, sort order, initial state on create.

```typescript
import { rule } from '@aomex/common';

rule.int().min(1).default(1); // [!code highlight]
rule.enum(['asc', 'desc']).default('desc');
rule.date().default(() => {
  return new Date();
});
```

Default may be a function evaluated at validation time—good for “now” or config reads. Logs may show defaults when the client omitted a field—remember when debugging.

### strict(is?: boolean)

Tighter type contract—less loose coercion (e.g. strings silently becoming numbers).

**When to use:** hard JSON body contracts; **query / forms** are almost all strings—usually leave strict off.

```typescript
import { rule } from '@aomex/common';

rule.int().strict();
// '18' → fail

rule.object({ id: rule.int() }).strict();
```

`strict(false)` turns it off; not every factory has this chain (many booleans do not use strict).

::: warning
Query and forms are almost all strings—`strict()` on query commonly yields site-wide 400s.
:::

### transform(fn)

After validation (including defaults), reshape the value; **inferred type follows the return type**.

**When to use:** CSV in query, case normalization, map to business enums at the edge.

```typescript
import { rule } from '@aomex/common';

rule.string().transform((s) => {
  return s.split(',').map((x) => {
    return x.trim();
  });
}); // [!code highlight]

rule.string().optional().transform((s) => {
  return s ?? '';
});
```

May return a `Promise`. Do not put auth, quotas, or business rules in `transform`—failure paths are unclear; keep that in action / service. Bare [partial()](./schema#partial) may be restricted when any field has `transform`—partial named fields only.

### docs(schema, mode?)

Writes OpenAPI `description` / `example` etc.—**no runtime effect**.

**When to use:** frontend handoff, readable field docs in generated OpenAPI.

```typescript
import { rule } from '@aomex/common';

rule.string().docs({ description: 'Display name', example: 'Ada' });
rule.string().docs({ title: 'Name' }, 'replace');
```

`docs()` affects OpenAPI metadata only—it does **not** change runtime validation.

| Parameter | When to use |
| --- | --- |
| `mode: 'merge'` (default) | Append to existing docs |
| `mode: 'replace'` | Replace entirely |

### Validator.has(source, Type)

Static helper: whether a validator or field table **nests** an instance of a validator class.

**When to use:** plugins, codegen occasionally; rarely in business actions.

```typescript
import { Validator, rule, StringValidator } from '@aomex/common';

Validator.has(rule.string(), StringValidator);
Validator.has({ nest: { name: rule.string() } }, StringValidator);
```

## Next steps

- [schema](./schema) (partial / pick / extend)
- [Validator list](./builtins) (pick `rule.xxx()` by task)
- [Query string](/en/web/query) / [Request body](/en/web/body) (chains on routes)