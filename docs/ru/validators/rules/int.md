---
outline: deep
---

# rule.int()

Проверяет **целые числа**: номера страниц, количества, идентификаторы автоматического приращения, количество запасов (в пределах безопасного целочисленного диапазона).

Для общих методов цепочки см. [Общие цепочки](../chain); ниже — только **специфичные для rule** API.

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  page: rule.int().min(1).default(1), // [!code highlight]
  pageSize: rule.int().min(1).max(100).default(20),
});
// ?page=2 → page 为 2；省略 page → 1
```

- Во время выполнения выводится как `number` и `Number.isInteger`.
- Запрос часто отправляет `'2'` строки; значение по умолчанию, отличное от `strict`, приводит к `2`.
- При использовании `default(n)` недостающие поля по-прежнему будут печататься как `number`.

После `Number.MAX_SAFE_INTEGER` используйте [bigint](./bigint); для денег или ставок используйте [decimal](./decimal), а не `int` или голую [number](./number).

### min(n, inclusive?: boolean)

**Когда использовать:** страницы начинаются с 1, количество не менее 1; `inclusive: false` означает **больше, чем** `n`.

```typescript
import { rule } from '@aomex/common';

rule.int().min(1).default(1);
rule.int().min(0, false); // 必须 > 0
```

### max(n, включительно?: логическое значение)

**Когда использовать:** `pageSize` ограничение, ограничения по идентификатору партии.

```typescript
import { rule } from '@aomex/common';

rule.int().min(1).max(100).default(20);
```

Та же семантика, что и [0 / 1](./number), плюс требование целого числа.

### strict(is?: boolean)

**Когда использовать:** В теле JSON уже есть `number`; **обычно избегайте запроса** или `'1'` не работает.

```typescript
import { rule } from '@aomex/common';

rule.int().strict();'18' → 失败；18 → 通过；18.5 → 失败
```

::: warning
Включение `strict()` для запроса на разбивку на страницы — распространенная ошибка: строковые номера страниц перестают работать.
:::

For общие цепи см. [Общие цепочки](../chain); [number](./number) для десятичных знаков, [bigint](./bigint) для огромных целых чисел, [decimal](./decimal) для денег.
