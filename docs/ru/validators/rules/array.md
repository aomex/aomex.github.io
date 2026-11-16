---
outline: deep
---

# rule.array()

Проверяет **массивы**: списки тегов, пакетные идентификаторы, строки заказа (элементы могут вкладывать небольшие фигуры объектов).

Для общих методов цепочки см. [Общие цепочки](../chain); ниже — только **специфичные для rule** API.

```typescript
import { rule, schema } from '@aomex/common';

export const batchSchema = schema({
  ids: rule.array(rule.int()).length({ max: 100 }), // [!code highlight]
  tags: rule.array(rule.string()).length({ min: 1, max: 20 }),
});
```

- Правило элемента определяет `T[]`; формы объектов похожи на `array(object({...}))`.
- Методы `unique*` влияют на получение OpenAPI `uniqueItems` (см. каждый метод).
- После `forceToArray` одно значение запроса по-прежнему вводится как массив.

### length(n | { min?, max? })

**Когда использовать:** хотя бы один тег, ограничение пакета 100, пары широты и долготы длиной 2.

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).length({ min: 1, max: 20 });
rule.array(rule.number()).length(2);
```

### уникальный()

**Когда использовать:** дедупликация целых элементов (семантика `Set`; объекты по ссылке); пишет OpenAPI `uniqueItems: true`.

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).unique();
// ['a','a'] → 失败
```

`unique()` выполняет дедупликацию элементов объекта по ссылке — два структурно идентичных объекта не считаются дубликатами.

### unique(key)

**Когда использовать:** объекты строк, дедуплицированные с помощью `sku` / `userId`; нет `'a.b'` путей; не пишет OpenAPI `uniqueItems`.

```typescript
import { rule } from '@aomex/common';

rule.array({ sku: rule.string(), qty: rule.int() }).unique('sku');
```

### уникальный (фн)

**Когда использовать** теги без учета регистра, дедупликация по нормализованному полю.

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).unique((s) => { // [!code highlight]
  return s.toLowerCase();
});
// ['Ada', 'ada'] → 失败
```

### ForceToArray('разделитель', разделитель?)

**Когда использовать:** запрос `?tags=a,b,c` или `?ids=1,2,3` поступает в виде одной строки.

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).forceToArray('separator');
rule.array(rule.int()).forceToArray('separator', '|');
```

### ForceToArray('блокировать')

**Когда использовать:** единственный выбор: `?tag=news` — это строка, а не `['news']`.

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).forceToArray('block');
// 'news' → ['news']
```

Без `forceToArray` в массивах запросов одиночные и множественные фигуры расходятся, и 400-е легко найти.

Для общих цепочек см. [Общие цепочки](../chain); см. также [object](./object), [string](./string), [int](./int).
