---
outline: deep
---

# rule.date()

Coerces input to **Date**: booking time, birthday, report ranges, analytics timestamps.

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only.

```typescript
import { rule, schema } from '@aomex/common';

export const bookingSchema = schema({
  at: rule.date().min(() => { // [!code highlight]
    return new Date();
  }),
});
// ISO string or timestamp → Date; before now → fail
```

- Infers as `Date` after validation.
- Factory accepts a Luxon format string; otherwise ISO is typical and timestamps parse by default.
- `min` / `max` take **functions** so each validation reads a fresh boundary—avoid freezing at process start.

### min(freshDate: () => Date, inclusive?: boolean)

**When to use:** no bookings in the past, effective date not before today.

```typescript
import { rule } from '@aomex/common';

rule.date().min(() => {
  return new Date();
});
```

::: warning
Pass functions to `min` / `max` for fresh bounds—do not write `min(new Date())` and freeze at boot time.
:::

### max(freshDate: () => Date, inclusive?: boolean)

**When to use:** no future dates, events end within one year.

```typescript
import { rule } from '@aomex/common';

rule.date().max(() => {
  return new Date();
}); // [!code highlight]

rule.date().max(() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d;
});
```

### parseFromTimestamp(is?: boolean)

**When to use:** on by default—mobile millisecond timestamps; `parseFromTimestamp(false)` when the contract is ISO only.

```typescript
import { rule } from '@aomex/common';

rule.date(); // 1711257956199 → Date
rule.date().parseFromTimestamp(false);
```

Custom format tokens: [Luxon formatting table](https://moment.github.io/luxon/#/formatting?id=table-of-tokens).

When you store calendar dates without caring about time zone, align business rules and DB types—do not rely on default ISO parsing to hide time zones.

For shared chains see [Common chains](../chain); [int](./int) for pure timestamp numbers, [string](./string).