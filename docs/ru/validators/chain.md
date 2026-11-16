---
outline: deep
---

# Общие цепочки

На любом `rule.xxx()` можно повесить **общие цепочки**: передано ли поле, допустим ли `null`, нужен ли default, strict, transform и docs. Это ортогонально специфичным методам вроде `trim` и `min` — см. отдельные страницы в [Список валидаторов](./builtins).

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  page: rule.int().min(1).default(1),
  q: rule.string().trim().optional(),
});

// GET ?page=2&q=ada  → { page: 2, q: 'Ada' }（若你还链了 transform）
// GET 省略 page     → { page: 1, q: undefined }
```

Пагинация по умолчанию плюс опциональный поиск — связка, которую вы почти всегда собираете первой.

- После `optional()` в выводе типов часто `T | undefined`; после `default(...)` поле обычно всегда есть — пропуск клиента даёт default.
- `nullable()` отдельно разрешает JSON `null`, это не то же самое, что «не передано»; при PATCH очистка — `null`, не `undefined`.
- При `strict()` строка `'18'` часто не проходит `rule.int()`; в query почти всегда строки — **обычно strict на query не включают**.
- `transform(fn)` подменяет тип поля типом возврата — после `rule.string().transform(...)` вывод следует за transform, а не за `string`.
- `docs(...)` **не меняет** runtime-типы — только метаданные OpenAPI.

У части комбинаторов или `file` может не быть `default` / `strict` — смотрите отдельную страницу.

Ниже у каждого метода есть «когда использовать» и демо для копирования; типичный порядок: ограничения типа, затем `default` / `optional`, затем `transform` и `docs`.

### optional()

Поле можно не передавать. `undefined` и пустая строка `''` по умолчанию часто считаются «пустым» — с `optional` проверка проходит, значение `undefined`.

**Когда использовать:** фильтры списков, частичный PATCH, необязательные флаги Console.

```typescript
import { rule } from '@aomex/common';

// GET /users?q=ada —— q 可以完全不出现
rule.string().trim().optional();
```

Если уже есть [default(...)](#defaultvalue--value), `optional()` обычно не нужен — хватает default. Для строк, где пустая строка — валидное значение, см. [allowEmptyString()](./rules/string).

### required()

Обратное `optional()` — снова обязательное поле.

**Когда использовать:** после чернового `partial()` на schema — формальная отправка снова ужесточает.

```typescript
import { rule } from '@aomex/common';

const title = rule.string().optional();
title.required();
```

При уже заданном `default(...)` вызов `required()` **обычно не** снимает default — пропуск всё равно даёт значение по умолчанию.

### nullable()

Разрешает JSON `null`, отдельно от «не передано».

**Когда использовать:** в PATCH «передать `null` чтобы очистить, не передавать — не менять».

```typescript
import { rule } from '@aomex/common';

rule.string().nullable().optional();
// null → 清空；没传 → undefined，业务里跳过该字段

rule.int().nullable();
```

Без `nullable` иногда `null` трактуют как пустое — ориентируйтесь на подсказки типов.

Для очистки в PATCH — `nullable()` и `null`; для «без изменений» — пропуск → `undefined`; не полагайтесь только на `optional()`, чтобы различать эти случаи.

### default(value | () => value)

При отсутствии или пустоте подставляется default; поле перестаёт быть обязательным; сам default **обычно не** проходит повторную проверку типа.

**Когда использовать:** пагинация, сортировка, начальное состояние при создании.

```typescript
import { rule } from '@aomex/common';

rule.int().min(1).default(1); // [!code highlight]
rule.enum(['asc', 'desc']).default('desc');
rule.date().default(() => {
  return new Date();
});
```

Default может быть функцией, вызываемой при валидации — удобно для «сейчас» или чтения конфига. В логах «клиент не передал» может отображаться как default — помните при отладке.

### strict(is?: boolean)

Жёстче контракт типов — меньше мягкого приведения (например строки к числу).

**Когда использовать:** жёсткий JSON body; **query / формы** почти всегда строки — strict обычно выключают.

```typescript
import { rule } from '@aomex/common';

rule.int().strict();
// '18' → 失败

rule.object({ id: rule.int() }).strict();
```

`strict(false)` отключает режим; не у каждой фабрики есть эта цепочка (многие boolean без strict).

::: warning
Query и формы почти всегда строки — `strict()` на query часто даёт массовые 400.
:::

### transform(fn)

После проверки (включая default) значение приводится к нужной форме; **выведенный тип следует за типом возврата**.

**Когда использовать:** CSV в query, нормализация регистра, приведение к бизнес-enum на границе.

```typescript
import { rule } from '@aomex/common';

rule.string().transform((s) => {
  return s.split(',').map((x) => {
    return x.trim();
  });
}); // [!code highlight]

rule.string().optional().transform((s) => {
  return s ?? '';
});
```

Можно вернуть `Promise`. Не кладите в `transform` права, квоты и бизнес-правила — путь ошибки неочевиден; оставьте в action / сервисе. Безымянный [partial()](./schema#partial) может быть ограничен, если у поля есть `transform` — делайте `partial` по именам полей.

### docs(schema, mode?)

Пишет в OpenAPI `description` / `example` и т.п. — **на runtime не влияет**.

**Когда использовать:** передача фронтенду, читаемые поля в сгенерированном OpenAPI.

```typescript
import { rule } from '@aomex/common';

rule.string().docs({ description: '用户昵称', example: 'Ada' });
rule.string().docs({ title: 'Name' }, 'replace');
```

`docs()` меняет только метаданные OpenAPI — **не** меняет runtime-поведение проверки.

| Параметр | Когда использовать |
| --- | --- |
| `mode: 'merge'` (по умолчанию) | добавить к уже заданным docs |
| `mode: 'replace'` | полностью заменить |

### Validator.has(source, Type)

Статический помощник: есть ли в валидаторе или таблице полей **вложенный** экземпляр класса валидатора.

**Когда использовать:** плагины, codegen — изредка; в бизнес-action почти не нужен.

```typescript
import { Validator, rule, StringValidator } from '@aomex/common';

Validator.has(rule.string(), StringValidator);
Validator.has({ nest: { name: rule.string() } }, StringValidator);
```

## Дальше

- [schema](./schema) (partial / pick / extend)
- [Список валидаторов](./builtins) (выбрать `rule.xxx()` по задаче)
- [Строка запроса](/ru/web/query) / [Тело запроса](/ru/web/body) (цепочки на маршрутах)