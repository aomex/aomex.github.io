---
outline: deep
---

# rule.ulid()

Проверяет строки **ULID** (26 символов, примерно упорядоченные по времени): orderId, синхронизируют курсоры типа `after`.

Для общих методов цепочки см. [Общие цепочки](../chain); ниже — только **специфичные для rule** API.

```typescript
import { rule, schema } from '@aomex/common';

export const orderParams = schema({
  orderId: rule.ulid().required(), // [!code highlight]
});
// '01ARZ3NDEKTSV4RRFFQ69G5FAV' → 通过
```

- После проверки выводится как `string`.
- Нет заводских опций типа версии; опциональное/по умолчанию поведение использует [Общие цепочки](../chain).

Для общих цепочек см. [Общие цепочки](../chain); см. также [uuid](./uuid), [int](./int), [bigint](./bigint).
