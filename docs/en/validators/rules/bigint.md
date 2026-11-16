---
outline: deep
---

# rule.bigint()

Validates **big integers** (`bigint`): wei on chain, Snowflake IDs, counts beyond safe integer range.

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only.

```typescript
import { rule, schema } from '@aomex/common';

export const ledgerSchema = schema({
  amountWei: rule.bigint().min(0n), // [!code highlight]
});
// body: { amountWei: '9007199254740992' } → 9007199254740992n
```

- Infers as `bigint` after validation.
- HTTP JSON has no native `bigint`; bodies often use **string** digits—non-`strict` mode may coerce.
- Call `.toString()` or a custom replacer before serializing responses.

Do not pass `bigint` straight into `JSON.stringify`—clients will break.

### min(value: bigint, inclusive?: boolean)

**When to use:** minimum deposit, cursor must be greater than the previous page ID (`inclusive: false` means strictly greater).

```typescript
import { rule } from '@aomex/common';

rule.bigint().min(100n);
rule.bigint().min(100n, false);
```

### max(value: bigint, inclusive?: boolean)

**When to use:** per-tx caps, quota ceilings.

```typescript
import { rule } from '@aomex/common';

rule.bigint().min(0n).max(10_000_000_000_000_000_000n);
```

### strict(is?: boolean)

**When to use:** accept only real `bigint`, block edge cases like `'1e3'` strings.

```typescript
import { rule } from '@aomex/common';

rule.bigint().strict();
// '123' → fail
```

For shared chains see [Common chains](../chain); see also [int](./int), [decimal](./decimal), [hash](./hash).