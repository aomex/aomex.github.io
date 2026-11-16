---
outline: deep
---

# rule.array()

Validates **arrays**: tag lists, batched IDs, order lines (elements can nest small object shapes).

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only.

```typescript
import { rule, schema } from '@aomex/common';

export const batchSchema = schema({
  ids: rule.array(rule.int()).length({ max: 100 }), // [!code highlight]
  tags: rule.array(rule.string()).length({ min: 1, max: 20 }),
});
```

- The element rule decides `T[]`; object shapes are like `array(object({...}))`.
- `unique*` methods affect whether OpenAPI gets `uniqueItems` (see each method).
- After `forceToArray`, a single query value still types as an array.

### length(n | { min?, max? })

**When to use:** at least one tag, batch cap 100, lat/lng pairs of length 2.

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).length({ min: 1, max: 20 });
rule.array(rule.number()).length(2);
```

### unique()

**When to use:** dedupe whole items (`Set` semantics; objects by reference); writes OpenAPI `uniqueItems: true`.

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).unique();
// ['a','a'] → fail
```

`unique()` dedupes object elements by reference—two structurally identical objects are not considered duplicates.

### unique(key)

**When to use:** row objects deduped by `sku` / `userId`; no `'a.b'` paths; does not write OpenAPI `uniqueItems`.

```typescript
import { rule } from '@aomex/common';

rule.array({ sku: rule.string(), qty: rule.int() }).unique('sku');
```

### unique(fn)

**When to use:** case-insensitive tags, dedupe by a normalized field.

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).unique((s) => { // [!code highlight]
  return s.toLowerCase();
});
// ['Ada', 'ada'] → fail
```

### forceToArray('separator', separator?)

**When to use:** query `?tags=a,b,c` or `?ids=1,2,3` arrives as one string.

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).forceToArray('separator');
rule.array(rule.int()).forceToArray('separator', '|');
```

### forceToArray('block')

**When to use:** single choice `?tag=news` is a string, not `['news']`.

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).forceToArray('block');
// 'news' → ['news']
```

Without `forceToArray` on query arrays, single vs multiple shapes diverge and 400s are easy to hit.

For shared chains see [Common chains](../chain); see also [object](./object), [string](./string), [int](./int).