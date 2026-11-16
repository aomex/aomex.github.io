---
outline: deep
---

# rule.literal()

Значение должно **точно равняться** фиксированному литералу: вебхук `event`, дискриминируемый `type`, фиксированный `action: 'ping'`.

Для общих методов цепочки см. [Общие цепочки](../chain); ниже — только **специфичные для rule** API.

```typescript
import { rule, schema } from '@aomex/common';

export const pingSchema = schema({
  action: rule.literal('ping'), // [!code highlight]
});
// { action: 'ping' } → 通过；'pong' → 失败；'1' 与 1 不相等
```

- Сужает вывод до буквального типа (например, `'ping'`).
- Никакого принуждения – `'1'` и `1` — это разные ветви.
- Нет цепочки, специфичной для правил; `optional` / `default` см. [Общие цепочки](../chain).

Для общих цепочек см. [Общие цепочки](../chain); см. также [enum](./enum), [oneOf](./one-of), [anyOf](./any-of).
