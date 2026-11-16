---
outline: deep
---

# rule.decimal()

Проверяет суммы, курсы валют и налоги с помощью **decimal.js** — позволяет избежать проблем с плавающей запятой, таких как `0.1 + 0.2`.

Для общих методов цепочки см. [Общие цепочки](../chain); ниже — только **специфичные для rule** API.

```typescript
import { rule, schema } from '@aomex/common';

export const paySchema = schema({
  amount: rule.decimal().min('0.01').max('50000'), // [!code highlight]
});
// body: { amount: '19.99' } → Decimal 实例
```

- Значение времени выполнения обычно равно `Decimal` из decimal.js, а не `number`.
- `default('0')` переносит строку/число в `Decimal` по умолчанию.
- Перед ответами JSON, обычно `.toString()` — не создавайте `JSON.stringify` объекты с неповрежденными методами.

Типы OpenAPI/интерфейса часто `string`; конвертируйте на границах вашего бизнеса, чтобы соответствовать времени выполнения `Decimal`.

### min(value, inclusive?: boolean)

**Когда использовать:** минимальный платеж, неотрицательный баланс; `value` может быть `string`/`number`/`Decimal`.

```typescript
import { rule } from '@aomex/common';

rule.decimal().min('0.01');
rule.decimal().min(0, false);
```

### max(значение включительно?: логическое значение)

**Когда использовать:** ограничение за отправку, скидка не превышает 1.

```typescript
import { rule } from '@aomex/common';

rule.decimal().min('0.01').max('50000');
```

### по умолчанию(значение)

****Когда использовать:** new account balance starts at 0, optional shipping defaults to 0 (wrapped as `Decimal`).

```typescript
import { rule } from '@aomex/common';

rule.decimal().default('0');
```

### строгий(есть?: логическое значение)

**Когда использовать:** внутренние пути уже передают `Decimal` экземпляров; внешний HTTP обычно сохраняет принятие строки по умолчанию.

```typescript
import { rule } from '@aomex/common';

rule.decimal().strict();'1.5' → 失败
```

После проверки оставьте арифметику на `Decimal`; не смешивайте сырые `number` на слоях представления или хранения.

Для общих цепочек см. [Общие цепочки](../chain); см. также [number](./number), [int](./int), [bigint](./bigint).
