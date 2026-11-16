---
outline: deep
---

# rule.enum()

Ограничивает поле **конечным набором**: `status`, `sort`, `role` (отображается в OpenAPI `enum`).

Для общих методов цепочки см. [Общие цепочки](../chain); ниже — только **специфичные для rule** API.

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  sort: rule.enum(['asc', 'desc']).default('desc'), // [!code highlight]
});
// ?sort=asc → 'asc'；非法值 → 失败
```

- Выводит как объединение литералов или членов перечисления (при передаче перечисления TS).
- `pick`/`omit` дают новый валидатор перечисления, часто сохраняя `optional`/`default`.
- Пустые `pick`/`omit` или `default` вне набора бросков во время настройки.

### pick(...values | values[])

**Когда использовать:** полный статус установлен для администратора; только API публикации пользователя `draft` → `published`.

```typescript
import { rule } from '@aomex/common';

const status = rule.enum(['draft', 'published', 'archived']);
status.pick('draft', 'published');
status.pick(['draft', 'published']);
```

### опустить(...значения | значения[])

**Когда использовать:** create не может выбрать `archived`; Раскрывающийся список фильтров скрывает внутренние состояния.

```typescript
import { rule } from '@aomex/common';

rule.enum(['draft', 'published', 'archived']).omit('archived');
```

После изменения `default` убедитесь, что он все еще находится в наборе после `pick`/`omit`.

### strict(is?: boolean)

**Когда использовать:** числовые перечисления, когда тело уже равно `number`; строки запроса обычно остаются нестрогими.

```typescript
import { rule } from '@aomex/common';

rule.enum([0, 1, 2]).strict();'1' → 失败；1 → 通过
```

Для общих цепочек см. [Общие цепочки](../chain); см. также [literal](./literal), [oneOf](./one-of), [string](./string).
