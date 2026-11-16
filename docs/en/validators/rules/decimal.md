---
outline: deep
---

# rule.decimal()

Validates amounts, FX rates, and tax with **decimal.js**—avoids float issues like `0.1 + 0.2`.

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only.

```typescript
import { rule, schema } from '@aomex/common';

export const paySchema = schema({
  amount: rule.decimal().min('0.01').max('50000'), // [!code highlight]
});
// body: { amount: '19.99' } → Decimal instance
```

- Runtime value is usually `Decimal` from decimal.js, not `number`.
- `default('0')` wraps string/number into `Decimal` for the default.
- Before JSON responses, typically `.toString()`—do not `JSON.stringify` objects with methods intact.

OpenAPI / frontend types are often `string`; convert at your business boundary to match runtime `Decimal`.

### min(value, inclusive?: boolean)

**When to use:** minimum payment, non-negative balance; `value` may be `string` / `number` / `Decimal`.

```typescript
import { rule } from '@aomex/common';

rule.decimal().min('0.01');
rule.decimal().min(0, false);
```

### max(value, inclusive?: boolean)

**When to use:** per-tx cap, discount not above 1.

```typescript
import { rule } from '@aomex/common';

rule.decimal().min('0.01').max('50000');
```

### default(value)

**When to use:** new account balance starts at 0, optional shipping defaults to 0 (wrapped as `Decimal`).

```typescript
import { rule } from '@aomex/common';

rule.decimal().default('0');
```

### strict(is?: boolean)

**When to use:** internal paths already pass `Decimal` instances; external HTTP usually keeps default string acceptance.

```typescript
import { rule } from '@aomex/common';

rule.decimal().strict();
// '1.5' → fail
```

After validation, keep arithmetic on `Decimal`; do not mix raw `number` in presentation or storage layers.

For shared chains see [Common chains](../chain); see also [number](./number), [int](./int), [bigint](./bigint).