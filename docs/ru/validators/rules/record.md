---
outline: deep
---

# rule.record()

Модели **`Record<string, V>`**: флаги функций, копия i18n, карты тегов → весов — произвольные ключи, универсальный тип значения.

Для общих методов цепочки см. [Общие цепочки](../chain); ниже — только **специфичные для rule** API.

```typescript
import { rule, schema } from '@aomex/common';

export const flagsSchema = schema({
  features: rule.record(rule.boolean()), // [!code highlight]
});
// { darkMode: true, beta: false } → 通过
```

- То же, что и `rule.object().additional({ value })`; выводится как любой строковый ключ + тип фиксированного значения.
- Поместите `min` / `optional` в правило **значения**, а не в самом `record`.
- Нет цепочки, специфичной для правил; `optional` / `default` см. [Общие цепочки](../chain).

Для общих цепочек см. [Общие цепочки](../chain); см. также [object](./object), [any](./any), [boolean](./boolean).
