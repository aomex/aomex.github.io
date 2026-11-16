---
outline: deep
---

# rule.allOf()

Входные данные должны удовлетворять **всем** правилам в массиве одновременно — это удобно для повторного использования фрагментов паролей или фрагментов формата ключей API в команде.

Для общих методов цепочки см. [Общие цепочки](../chain); ниже — только **специфичные для rule** API.

```typescript
import { rule, schema } from '@aomex/common';

const passwordBase = rule.string().length({ min: 8, max: 72 });
const passwordDigit = rule.string().match(/\d/);

export const registerSchema = schema({
  password: rule.allOf([passwordBase, passwordDigit]).required(), // [!code highlight]
});
// 'passw0rd!' → 通过；'short' → 失败
```

- Выводится как **пересечение** выходов ветвей (часто одно и то же `string` со сложенными ограничениями).
- Нет цепочки, специфичной для правил.
- Объединение `.length().match()` в одно поле часто более четкое; `allOf` светится при **повторном использовании фрагментов в разных файлах**.

Для общих цепочек см. [Общие цепочки](../chain); см. также [string](./string), [anyOf](./any-of), [oneOf](./one-of).
