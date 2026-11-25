---
outline: deep
---

# Строка запроса

Для GET (и других методов с query) объяви `?page=1&keyword=`: в `mount` маршрута — `query()` и [валидаторы](/ru/validators/). После прохождения — `ctx.query`; иначе автоматически **400**, action не вызывается.

```typescript
import { rule } from '@aomex/common';
import { query, Router } from '@aomex/web';

export const router = new Router();

router.get('/users', { // [!code focus:13]
  mount: [
    query({ // [!code highlight]
      page: rule.int().min(1).default(1),
      size: rule.int().min(5).max(50).default(10),
      keyword: rule.string().optional(),
    }),
  ],
  action: async (ctx) => {
    const { page, size, keyword } = ctx.query;
    ctx.send({ page, size, keyword, items: [] });
  },
});
```

Пример: GET /users?page=2&size=20&keyword=ada.

После `query()` в `ctx.query` только объявленные ключи; с `default()` отсутствующие параметры в типах обязательны (page всегда number). С `optional()` — `undefined`. Без `query()` в mount — широкий `ctx.request.query`, не доверяй как проверенным данным. Ошибка валидации — **400**, action не вызывается.

Не пиши в action `Number(ctx.request.query.page)` — оторвёшься от OpenAPI, формата ошибок и автоматического сужения типов.

## Общая schema списка

Если несколько списковых API делят `page` / `size` / `q`, собери поля в `src/schemas/*.schema.ts` и на маршруте `query(listQuerySchema)`. Меняешь лимиты и default в одном месте — OpenAPI следует той же схеме.

Общая пагинация / поиск `q`:

```typescript
// src/schemas/list-query.schema.ts
import { schema, rule } from '@aomex/common';

export const listQuerySchema = schema({
  page: rule.int().min(1).default(1),
  size: rule.int().max(100).default(20),
  q: rule.string().trim().optional(),
});
```

```typescript
// src/routers/user.ts
import { query, Router } from '@aomex/web';
import { listQuerySchema } from '@/schemas/list-query.schema';

const router = new Router();

router.get('/users', { // [!code focus:6]
  mount: [query(listQuerySchema)], // [!code highlight]
  action: async (ctx) => {
    const { page, size, q } = ctx.query;
    ctx.send(await searchUsers({ page, size, q }));
  },
});
```

Перечисление поля сортировки:

```typescript
sort: rule.enum(['name', 'createdAt'] as const).default('createdAt'),
```

Описание OpenAPI на rule или маршруте:

```typescript
page: rule.int().min(1).docs({ description: 'Номер страницы, с 1' }),
```

## Разделение с body и params

Не смешивай роли: **query** — фильтр и пагинация (идемпотентный GET), **params** — id ресурса в пути, **body** — сущность create/update. Иначе кэш, логи и OpenAPI расходятся с реальной семантикой.

| Источник | Типично |
| --- | --- |
| **query** | Фильтр, страницы, сортировка — идемпотентный GET |
| **params** | ID ресурса в URL |
| **body** | Сущность для POST / PUT / PATCH |

Большой JSON-фильтр в query раздувает URL и ломает ключи кэша — иногда POST + `body()`, ценой идемпотентного GET-кэша. POST для создания с большим JSON в query — тоже плохая практика.

::: tip
Клиенты списков часто шлют лишние трекинг-параметры. Слишком strict query или лишние required дают 400 при B2B. `default()` даёт значение в типах, но в логе URL может не быть `?page=1`.
:::

## Дальше

- [Параметры пути](/ru/web/params)
- [Тело запроса](/ru/web/body)
- [Цепочка валидатора](/ru/validators/chain): default, optional, transform