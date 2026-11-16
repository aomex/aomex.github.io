---
outline: deep
---

# Валидаторы

Грязные внешние данные превращаются в то, чему вы доверяете в runtime: плохой ввод отсекается, TypeScript сужает типы. Web `body()` / `query()`, Console `options()` и OpenAPI часто **делят одни и те же `rule`** — без дублирования interface.

```typescript
import { rule, validate, schema, type Validator } from '@aomex/common';
```

```typescript
import { rule, validate } from '@aomex/common';

const input = { name: '  Ada  ', age: '18', hack: true };

const user = await validate(input, { // [!code highlight]
  name: rule.string().trim().length({ min: 1, max: 32 }),
  age: rule.int().min(0).optional(),
});

await doSomething(user);
```

Наведите на `user`:

- `name` → `string` (после trim)
- `age` → `number | undefined` (`'18'` обычно станет числом; optional)
- без `hack` — необъявленные ключи по умолчанию отбрасываются

На маршрутах после `body({ ... })` у `ctx.body` уже суженный тип — без ручного `validate`.

::: tip
Не ведите параллельно Zod и ручные interface — при смене полей они расходятся. Один набор `rule` закрывает и runtime, и типы.
:::

## Что выбрать

| Задача | Что использовать |
| --- | --- |
| Одно поле | `rule.string()` / `rule.int()` … → [Список валидаторов](./builtins) |
| Переиспользуемые поля / PATCH | [`schema`](./schema) в `src/schemas/xxx.schema.ts` |
| Разовая проверка в скрипте / тесте | [Ручная валидация](./validate) |
| Вложение, массивы, ветвление | [object](./rules/object) / [array](./rules/array) / [oneOf](./rules/one-of) |
| Наличие / default / заметки в docs | [Общие цепочки](./chain) |

Произвольные ключи — явно [rule.record()](./rules/record); необъявленные поля сами не сохранятся.

::: warning
`rule.any()` работает, но типы и OpenAPI размываются — для перехода сойдёт, на публичных API избегайте.
:::

## В этом разделе

| Страница | Когда открывать |
| --- | --- |
| [Список валидаторов](./builtins) | Найти конкретный `rule.xxx` |
| [Общие цепочки](./chain) | `optional` / `default` / `transform`… |
| [schema](./schema) | pick / omit / partial |
| [Prisma](/ru/plugins/prisma) | проверка из схемы таблицы |
| [Ручная валидация](./validate) | `validate` в скриптах / тестах |
| [Кастомные валидаторы](/ru/advanced/validator) | когда встроенного мало (продвинутый уровень) |
