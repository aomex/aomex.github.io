---
outline: deep
---

# rule.date()

Принуждает ввод к **Дата**: время бронирования, день рождения, диапазоны отчетов, временные метки аналитики.

Для общих методов цепочки см. [Общие цепочки](../chain); ниже — только **специфичные для rule** API.

```typescript
import { rule, schema } from '@aomex/common';

export const bookingSchema = schema({
  at: rule.date().min(() => { // [!code highlight]
    return new Date();
  }),
});
// ISO 字符串或时间戳 → Date；早于 now → 失败
```

- После проверки выводится как `Date`.
- Фабрика принимает строку формата Luxon; в противном случае ISO является типичным и анализирует временные метки по умолчанию.
- `min` / `max` возьмите **функции**, чтобы при каждой проверке считывалась новая граница — избегайте зависания при запуске процесса.

### min(freshDate: () => Date, inclusive?: boolean)

**Когда использовать**: в прошлом бронирований не было, дата вступления в силу не раньше сегодняшнего дня.

```typescript
import { rule } from '@aomex/common';

rule.date().min(() => {
  return new Date();
});
```

::: warning
Передайте функции `min`/`max` для новых границ — не записывайте `min(new Date())` и не зависайте во время загрузки.
:::

### max(freshDate: () => Date, inclusive?: boolean)

**Когда использовать**: даты в будущем отсутствуют, мероприятия завершатся в течение одного года.

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

**Когда использовать:** включено по умолчанию — временные метки мобильных устройств в миллисекундах; `parseFromTimestamp(false)`, когда контракт только ISO.

```typescript
import { rule } from '@aomex/common';

rule.date(); // 1711257956199 → Date
rule.date().parseFromTimestamp(false);
```

Токены пользовательского формата: [Luxon formatting table](https://moment.github.io/luxon/#/formatting?id=table-of-tokens).

Когда вы храните календарные даты, не заботясь о часовом поясе, согласовывайте бизнес-правила и типы БД — не полагайтесь на синтаксический анализ ISO по умолчанию для сокрытия часовых поясов.

Для общих цепочек см. [Общие цепочки](../chain); [int](./int) для чистых номеров временных меток, [string](./string).
