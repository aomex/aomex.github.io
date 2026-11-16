---
outline: deep
---

# rule.number()

Validates **finite numbers (including decimals)**: ratings, ratios, lat/lng components, progress—not money decimals.

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only.

```typescript
import { rule, schema } from '@aomex/common';

export const ratingSchema = schema({
  score: rule.number().min(0).max(5).precision(1), // [!code highlight]
});
// body: { score: 4.56 } → toFixed(1) then range check, often 4.6
```

- Infers as `number` (not `Decimal`; money uses [decimal](./decimal)).
- Query `'3.5'` coerces to `3.5` by default; `strict()` accepts only `number`.
- `precision(n)` changes output decimal places; type stays `number`.

### min(n, inclusive?: boolean)

**When to use:** non-negative weights, progress, discount lower bounds.

```typescript
import { rule } from '@aomex/common';

rule.number().min(0);
rule.number().min(0, false); // must be > 0
```

### max(n, inclusive?: boolean)

**When to use:** five-star cap, ratio ≤ 1, longitude range.

```typescript
import { rule } from '@aomex/common';

rule.number().min(0).max(5);
```

### precision(decimals: number)

**When to use:** slider with long tails, API “at most two decimals”; `toFixed` then `min`/`max`.

```typescript
import { rule } from '@aomex/common';

rule.number().precision(2);
rule.number().min(0).max(100).precision(1);
```

`precision` uses `toFixed` before `min`/`max`—if that disagrees with banker’s rounding in your domain, handle it in `transform` or the action.

### strict(is?: boolean)

**When to use:** JSON body is already `number`; keep query loose by default.

```typescript
import { rule } from '@aomex/common';

rule.number().strict();
// '1.5' → fail
```

For shared chains see [Common chains](../chain); see also [int](./int), [decimal](./decimal), [bigint](./bigint).