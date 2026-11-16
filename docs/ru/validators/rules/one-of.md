---
outline: deep
---

# rule.oneOf()

Входные данные должны соответствовать **ровно одной** ветви; если несколько пройдено, проверка **не пройдена** (дискриминируемые объединения, взаимоисключающие способы оплаты).

Для общих методов цепочки см. [Общие цепочки](../chain); ниже — только **специфичные для rule** API.

```typescript
import { rule, schema } from '@aomex/common';

export const payMethodSchema = schema({
  method: rule.oneOf([ // [!code highlight]
    rule.object({
      type: rule.literal('card'),
      last4: rule.string().length(4),
    }),
    rule.object({
      type: rule.literal('balance'),
      amount: rule.decimal().min('0.01'),
    }),
  ]),
});
```

- Выводится как **объединение** типов вывода ветвей.
- Подправила внутри комбинации сохраняют свои собственные `min`/`match` и т. д.; у комбинатора нет дополнительных API цепочек.
- Нет семантики уровня комбинатора `default`/`strict`; используйте `optional`/`nullable`/`transform`/`docs` как обычно.

Для общих цепочек см. [Общие цепочки](../chain); см. также [anyOf](./any-of), [allOf](./all-of), [literal](./literal), [object](./object).
