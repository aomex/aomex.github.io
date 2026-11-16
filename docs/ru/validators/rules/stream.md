---
outline: deep
---

# rule.stream()

Проверяет **читаемый поток** (узел `Readable`): источники заданий экспорта, стандартный вывод подпроцесса, внутренние каналы заданий, а не поля тела JSON.

Для общих методов цепочки см. [Общие цепочки](../chain); ниже — только **специфичные для rule** API.

```typescript
import { Readable } from 'node:stream';
import { rule, schema } from '@aomex/common';

export const exportSchema = schema({
  format: rule.literal('csv'),
  source: rule.stream().required(), // [!code highlight]
});
// Readable.from([...]) → 通过；{ foo: 1 } → 失败
```

- После проверки сужается до читаемого типа потока (см. `Validator.Infer`).
- Нет цепочки, специфичной для правил; `optional` / `required` см. [Общие цепочки](../chain).
— Десериализация JSON никогда не дает реального потока — не ожидайте этого на маршрутах HTTP JSON.

Для общих цепочек см. [Общие цепочки](../chain); см. также [file](./file), [buffer](./buffer), [literal](./literal).
