---
outline: deep
---

# rule.uuid()

Проверяет **строки UUID** (с дефисами): путь `:id`, `parentId`, событие `correlationId`.

Для общих методов цепочки см. [Общие цепочки](../chain); ниже — только **специфичные для rule** API.

```typescript
import { rule, schema } from '@aomex/common';

export const paramsSchema = schema({
  id: rule.uuid('v4'), // [!code highlight]
});
// '550e8400-e29b-41d4-a716-446655440000' → 通过
```

- После проверки выводится как `string`.
- Фабрика принимает `v1`–`v8` или массив; без версии принимаются распространенные варианты.
- Сравнение обычно не учитывает регистр.

### match(pattern: RegExp)

**Когда использовать:** редко — UUID уже узок; только при укладке бизнес-префикса (большинство проектов используют отдельное поле).

```typescript
import { rule } from '@aomex/common';

rule.uuid('v4').match(/^550e8400-/);
```

Для общих цепочек см. [Общие цепочки](../chain); см. также [ulid](./ulid), [string](./string), [anyOf](./any-of).
