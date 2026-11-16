---
outline: deep
---

# rule.bigint()

Проверяет **большие целые числа** (`bigint`): wei on Chain, идентификаторы Snowflake, счетчики выходят за пределы безопасного целочисленного диапазона.

Для общих методов цепочки см. [Общие цепочки](../chain); ниже — только **специфичные для rule** API.

```typescript
import { rule, schema } from '@aomex/common';

export const ledgerSchema = schema({
  amountWei: rule.bigint().min(0n), // [!code highlight]
});
// body: { amountWei: '9007199254740992' } → 9007199254740992n
```

- После проверки выводится как `bigint`.
- HTTP JSON не имеет встроенного `bigint`; тела часто используют **строковые** цифры — режим, отличный от `strict`, может привести к принуждению.
– Прежде чем сериализовать ответы, позвоните по номеру `.toString()` или специалисту по замене.

Не передавайте `bigint` прямо в `JSON.stringify` — клиенты сломаются.

### min(value: bigint, inclusive?: boolean)

**Когда использовать:** минимальный депозит, курсор должен быть больше идентификатора предыдущей страницы (`inclusive: false` означает строго больше).

```typescript
import { rule } from '@aomex/common';

rule.bigint().min(100n);
rule.bigint().min(100n, false);
```

### max(значение: bigint, включительно?: логическое значение)

**Когда использовать**: ограничения на каждую передачу, максимальные квоты.

```typescript
import { rule } from '@aomex/common';

rule.bigint().min(0n).max(10_000_000_000_000_000_000n);
```

### строгий(есть?: логическое значение)

**Когда использовать:** принимать только реальные `bigint`, блокировать крайние случаи, например строки `'1e3'`.

```typescript
import { rule } from '@aomex/common';

rule.bigint().strict();'123' → 失败
```

Для общих цепочек см. [Общие цепочки](../chain); см. также [int](./int), [decimal](./decimal), [hash](./hash).
