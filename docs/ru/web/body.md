---
outline: deep
---

# Тело запроса

Для POST / PUT / PATCH задай JSON или form-тело: в `mount` повесь `body()` и опиши поля валидатором. После прохождения тип `ctx.body` сужается; неверная форма — **400**, слишком большой пакет — **413** (лимиты на уровне приложения — в [входе Web-приложения](/ru/web/), `body.payload` / `body.formData`).

```typescript
import { rule } from '@aomex/common';
import { body, Router } from '@aomex/web';

export const router = new Router();

router.post('/users', { // [!code focus:13]
  mount: [
    body({ // [!code highlight]
      username: rule.string().length({ min: 2, max: 32 }),
      age: rule.int().min(0).max(150).optional(),
    }),
  ],
  action: async (ctx) => {
    const { username, age } = ctx.body;
    ctx.send(201, { username, age });
  },
});
```

Типичные Content-Type: `application/json`, `application/x-www-form-urlencoded`, `text/*`; при `rule.file()` разбор идёт как `multipart/form-data`.

После `body({ username: rule.string(), age: rule.int().optional() })` у `ctx.body.username` тип string, у `age` — `number | undefined`. Для PATCH — `body(createPostSchema.partial())`: поля становятся необязательными, правила общие с POST. Корневой `body(rule.array(...))` или `body(rule.oneOf([...]))` даёт в `ctx.body` массив или union целиком. Без `body()` не используй `ctx.body` как уже проверенный ввод.

Не читай поток `req` и не делай свой `JSON.parse` — это конфликтует с уже разобранным `ctx.body` и ломает единые квоты.

## Лимит JSON на уровне приложения

`WebApp.body.payload.maxSize` ограничивает объём JSON / текстового тела **на всём сайте**; слишком большой запрос отсекается до проверки `body()` с **413**. Для публичных API и webhook с интернета — защита памяти; схема маршрута не спасёт, если тело вообще не распарсить.

Открытый API / webhook от больших тел:

```typescript
import { logger } from '@/services/logger.service';

new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  body: { // [!code focus:3]
    payload: { maxSize: '1mb' }, // [!code highlight]
  },
  mount: [routers('./src/routers')],
});
```

## Тело — массив в корне

Некоторые клиенты шлют **массив JSON в корне** (пакет ID, списки событий), а не `{ items: [...] }`. Передай в `body()` `rule.array(...)` или целую schema — после проверки `ctx.body` будет массивом.

Пакетное удаление, webhook с массивом:

```typescript
router.post('/batch-delete', {
  mount: [body(rule.array(rule.int()))], // [!code highlight]
  action: async (ctx) => {
    ctx.send({ deleted: ctx.body.length });
  },
});
```

## oneOf для взаимоисключающих форм

На один URL приходят ветки JSON по `type`, но в каждый момент должна подходить только одна. `rule.oneOf([...])` перебирает варианты; ровно один успех — ок, два или ноль — **400**.

```typescript
router.post('/events', { // [!code focus:13]
  mount: [
    body( // [!code highlight]
      rule.oneOf([
        rule.object({ type: rule.literal('a'), a: rule.int() }),
        rule.object({ type: rule.literal('b'), b: rule.string() }),
      ]),
    ),
  ],
  action: async (ctx) => {
    ctx.send({ ok: true });
  },
});
```

## Создание и PATCH

Создание — полная schema, частичное обновление — `.partial()` той же schema: в PATCH поля optional, правила те же, что у POST. Вынеси в `src/schemas/*.schema.ts` — маршруты ссылаются на одно определение.

```typescript
// src/schemas/post.schema.ts
import { schema, rule } from '@aomex/common';

export const createPostSchema = schema({
  title: rule.string(),
  content: rule.string(),
});
```

```typescript
import { body } from '@aomex/web';
import { createPostSchema } from '@/schemas/post.schema';

router.post('/posts', { // [!code focus:6]
  mount: [body(createPostSchema)], // [!code highlight]
  action: async (ctx) => {
    ctx.send(201, await createPost(ctx.body));
  },
});

router.patch('/posts/:id', {
  mount: [body(createPostSchema.partial())], // [!code highlight]
  action: async (ctx) => {
    ctx.send(await patchPost(ctx.params.id, ctx.body));
  },
});
```

::: warning
При `partial()` пустой `{}` тоже проходит — если нужно «хотя бы одно поле», проверь в action. Без Content-Type пустое тело может стать `{}`, и при всех optional клиент тихо «ничего не меняет».
:::

## С файлами

Аватары и вложения — `rule.file()`, подробности в [загрузке файлов](/ru/web/attach):

```typescript
router.post('/avatar', { // [!code focus:12]
  mount: [
    body({
      name: rule.string(),
      avatar: rule.file().maxSize('2mb').mimeTypes('image/*'), // [!code highlight]
    }),
  ],
  action: async (ctx) => {
    const { avatar } = ctx.body;
    await saveAvatar(avatar);
    ctx.send({ ok: true });
  },
});
```

| Запись | Результат |
| --- | --- |
| `{ avatar: rule.file() }` | Один файл, имя поля = name в форме |
| `{ photos: rule.array(rule.file()).length({ max: 5 }) }` | Несколько part с одним именем, до 5 |
| `rule.file()` во вложенном объекте | Обычно не совпадает с плоскими именами multipart |

Полевой `maxSize` и лимиты formData на уровне приложения — **строже из двух**. При **413** смотри оба уровня.

Перенос больших фильтров на POST + `body()` — явно опиши в доках и кэше, не обещай семантику GET.

## Дальше

- [Загрузка файлов](/ru/web/attach)
- [Ограничение ответа](/ru/web/response)
- [Вход Web-приложения](/ru/web/): квоты body на всём сайте