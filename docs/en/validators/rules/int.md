---
outline: deep
---

# rule.int()

Validates **integers**: page numbers, quantities, auto-increment IDs, stock counts (within safe integer range).

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only.

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  page: rule.int().min(1).default(1), // [!code highlight]
  pageSize: rule.int().min(1).max(100).default(20),
});
// ?page=2 → page is 2; omit page → 1
```

- Infers as `number` and `Number.isInteger` at runtime.
- Query often sends `'2'` strings; default non-`strict` coerces to `2`.
- With `default(n)`, missing fields still type as `number`.

Beyond `Number.MAX_SAFE_INTEGER` use [bigint](./bigint); for money or rates use [decimal](./decimal), not `int` or bare [number](./number).

### min(n, inclusive?: boolean)

**When to use:** pages start at 1, quantity at least 1; `inclusive: false` means **greater than** `n`.

```typescript
import { rule } from '@aomex/common';

rule.int().min(1).default(1);
rule.int().min(0, false); // must be > 0
```

### max(n, inclusive?: boolean)

**When to use:** `pageSize` cap, batch ID limits.

```typescript
import { rule } from '@aomex/common';

rule.int().min(1).max(100).default(20);
```

Same semantics as [`number.min` / `number.max`](./number), plus integer requirement.

### strict(is?: boolean)

**When to use:** JSON body already has `number`; **usually avoid on query** or `'1'` fails.

```typescript
import { rule } from '@aomex/common';

rule.int().strict();
// '18' → fail; 18 → pass; 18.5 → fail
```

::: warning
Turning on `strict()` for pagination query is a common footgun—string page numbers stop working.
:::

For shared chains see [Common chains](../chain); [number](./number) for decimals, [bigint](./bigint) for huge ints, [decimal](./decimal) for money.