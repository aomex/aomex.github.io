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
// ?sort=asc → 'asc'; недопустимое → ошибка
```

- Аргумент-массив выводится как объединение литералов (например `'asc' | 'desc'`).
- `pick` / `omit` дают новый валидатор перечисления, часто сохраняя `optional` / `default`.
- Пустые `pick` / `omit` или `default` вне набора бросают ошибку на этапе конфигурации.

Если в коде уже есть TypeScript `enum` (или enum-подобный объект с `as const`), передайте его прямо в `rule.enum` — отдельный массив копировать не нужно:

```typescript
import { rule, schema } from '@aomex/common';

enum Color {
  Red = 'red',
  Blue = 'blue',
}

export const patchBody = schema({
  color: rule.enum(Color), // [!code highlight]
});
// { color: 'red' } → Color.Red; 'green' → ошибка
```

После прохождения тип — член перечисления (`Color`), а не голое `'red' | 'blue'`: `ctx.body.color` можно сравнивать с `Color.Red`. Числовые enum ведут себя так же и выводятся как `Status`:

```typescript
import { rule } from '@aomex/common';

enum Status {
  Off = 0,
  On = 1,
}

rule.enum(Status); // → Status
```

Без ключевого слова `enum`, с одним const-объектом, добавьте `as const` и передайте объект; тип выводится как объединение значений:

```typescript
import { rule } from '@aomex/common';

const Role = { Admin: 'admin', User: 'user' } as const;

rule.enum(Role); // → 'admin' | 'user'
```

Значения объекта — только string / number; для boolean используйте массив: `rule.enum([true, false])`.

### pick(...values | values[])

**Когда использовать:** полный набор статусов для админки; пользовательский publish API только `draft` → `published`.

```typescript
import { rule } from '@aomex/common';

const status = rule.enum(['draft', 'published', 'archived']);
status.pick('draft', 'published');
status.pick(['draft', 'published']);
```

Если передан TS enum, в pick / omit берите сами члены: `rule.enum(Color).pick(Color.Red, Color.Blue)`.

### omit(...values | values[])

**Когда использовать:** при создании нельзя выбрать `archived`; в фильтре скрыть внутренние состояния.

```typescript
import { rule } from '@aomex/common';

rule.enum(['draft', 'published', 'archived']).omit('archived');
```

После смены `default` убедитесь, что он всё ещё в наборе после `pick` / `omit`.

### strict(is?: boolean)

**Когда использовать:** числовые enum, когда body уже `number`; строки query обычно оставляют без strict.

```typescript
import { rule } from '@aomex/common';

rule.enum([0, 1, 2]).strict();
// '1' → ошибка; 1 → ок
```

Для общих цепочек см. [Общие цепочки](../chain); см. также [literal](./literal), [oneOf](./one-of), [string](./string).
