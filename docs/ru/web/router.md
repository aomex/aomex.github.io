---
outline: deep
---

# HTTP-маршруты

Дели `src/routers` по доменам: каждый файл экспортирует `Router`, регистрируй action через `get` / `post`; в `mount` `WebApp` — `routers('./src/routers')` одним вызовом.

```typescript
// src/routers/user.ts
import { Router } from '@aomex/web';

export const router = new Router();

const users = [
  { id: 1, name: 'Ada' },
  { id: 2, name: 'Bob' },
];

router.get('/users', { // [!code focus:5]
  action: async (ctx) => {
    ctx.send(users);
  },
});

router.get('/users/count', {
  action: async (ctx) => {
    ctx.send({ count: users.length });
  },
});
```

Подключение к приложению:

```typescript
import { routers, WebApp } from '@aomex/web';

new WebApp({
  // services, logger, language, proxyIP …
  mount: [routers('./src/routers')], // [!code highlight]
});
```

Для тестов и флагов — конкретные экземпляры, без сканирования каталога:

```typescript
import { userRouter } from '@/routers/user';
import { postRouter } from '@/routers/post';

mount: [routers([userRouter, postRouter])],
```

`query()` / `body()` / `params()` / `response()` в `mount` одного маршрута сужают `ctx` в action. **Mount уровня метода** — только этот endpoint; **уровня Router** — `Router({ mount: [...] })` на все методы файла.

```typescript
router.get('/users', { // [!code focus:11]
  mount: [
    middleware.web<{ tenant: string }>(async (ctx, next) => { // [!code highlight]
      ctx.tenant = ctx.request.headers['x-tenant'] as string;
      await next();
    }),
  ],
  action: (ctx) => {
    ctx.tenant;
  },
});

router.get('/users/:id', {
  action: (ctx) => {
    ctx.tenant; // в типах нет
  },
});
```

## prefix

`Router({ prefix })` добавляет префикс **ко всем** путям файла — не пиши `/users` в каждом `router.get`. Смена `/v1` → `/v2` или разбиение URL — один параметр конструктора.

```typescript
import { rule } from '@aomex/common';
import { params, Router } from '@aomex/web';

export const router = new Router({ prefix: '/users' }); // [!code highlight]

router.get('/', { // [!code focus:5]
  action: async (ctx) => {
    ctx.send([]);
  },
});

router.get('/:id', {
  mount: [params({ id: rule.int().min(1) })],
  action: async (ctx) => {
    ctx.send({ id: ctx.params.id });
  },
});
```

Итоговый путь = prefix + uri при регистрации (лишние слэши нормализуются). При 404 смотри полный путь с prefix, не только `router.get('/:id')`.

Группировка OpenAPI: `Router({ docs: { tags: ['User'] } })`; `docs.summary` на маршруте переопределяет.

## mount уровня Router

`Router({ mount: [...] })` — middleware на весь файл: логин для группы, аудит, общие default в query. Удобнее, чем повтор в каждом `router.get`.

Логин и аудит на весь файл:

```typescript
new Router({
  prefix: '/admin',
  mount: [auth.authenticate('bearer')],
});
```

Mount уровня Router действует на **все** методы файла. Не смешивай публичные и защищённые в одном Router — вынеси публичное или используй mount/skip у метода.

## mount метода, docs, disabled

**Mount метода** — только этот маршрут: валидация (query / body / params / response), auth одного API. С mount Router — сначала Router, потом метод.

**disabled** — маршрут **не регистрируется** в runtime (нет match, нет action). Выключи черновой API флагом или env, безопаснее, чем 501 в проде.

**docs** — текст в OpenAPI (`summary` и т.д.). `Router({ docs: { tags } })` — группа; docs маршрута переопределяет заголовок и описание; в контракт уходит вместе с [response()](/ru/web/response).

```typescript
import { rule } from '@aomex/common';
import { query, response, Router } from '@aomex/web';

router.get('/users', { // [!code focus:11]
  disabled: process.env['FEATURE_USERS'] !== '1', // [!code highlight]
  mount: [
    query({ page: rule.int().min(1).default(1) }),
    response({ statusCode: 200, content: rule.array({ id: rule.int() }) }),
  ],
  docs: { summary: 'Список пользователей' }, // [!code highlight]
  action: async (ctx) => {
    ctx.send([]);
  },
});
```

Метаданные OpenAPI — [генерация OpenAPI](/ru/openapi/) · [Tags](/ru/openapi/tags).

Один path-параметр:

```typescript
router.get('/users/:id', {
  mount: [params({ id: rule.int().min(1) })], // [!code highlight]
  action: async (ctx) => {
    ctx.send({ id: ctx.params.id });
  },
});
```

Без `params()` в `ctx.request.params` всё строки — легко перепутать `"1"` и `1`.

## HTTP-методы

Каждый `router.<method>(uri, { ... })` привязывает глагол HTTP. Порядок регистрации не влияет на match; статические сегменты и литералы важнее `:param`.

| Метод | Смысл |
| --- | --- |
| `get` | `GET`; **HEAD** делит match с одноимённым `GET` |
| `post` / `put` / `patch` / `delete` | Соответствующие глаголы |
| `all` | Все перечисленные |
| `customize` | Свой массив глаголов |

`customize` — несколько глаголов на один путь (GET проверка, POST callback). Отдельные `get` / `post` — два маршрута и лишняя поддержка. Webhook, health с probe:

Webhook третьей стороны:

```typescript
router.customize(['GET', 'POST'], '/webhook', { // [!code highlight]
  action: async (ctx) => {
    ctx.send({ ok: true });
  },
});
```

## Запись пути

При регистрации **литеральные** сегменты важнее `:param` — `/users/count` не съедается `/:id`. Имена в `:param` совпадают с полями `params()`.

| Запись | Смысл |
| --- | --- |
| `/users/:id` | Именованный параметр `id` |
| `/users/count` рядом с `/users/:id` | Литерал в приоритете; `:id` не возьмёт `count`; не надейся на порядок регистрации — пиши статику явно |

При glob-скане в каталоге только экспорты Router — проще искать «почему не зарегистрировалось».

## Дальше

- [Вход Web-приложения](/ru/web/): WebApp и глобальный mount
- [Строка запроса](/ru/web/query): фильтр и пагинация GET
- [Параметры пути](/ru/web/params), [тело запроса](/ru/web/body)