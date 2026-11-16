---
outline: deep
---

# Тело запроса

Напишите чистый JSON или сформируйте тело для POST/PUT/PATCH: повесьте body() в монтировании и используйте валидатор для описания полей. После прохождения теста тип ctx.body сужается; форма неправильная **400**, а пакет слишком большой **413** (откорректируйте body.payload/body.formData в [Запись веб-приложения](/ru/web/)).

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

Общий тип контента: application/json, application/x-www-form-urlencoded, text/\*; появляется ` rule.file()`При анализе в соответствии с multipart/form-data.

` body({ username: rule.string(), age: rule.int().optional() })`После этого ctx.body.username — строка, а age — число | неопределенный. ` body(createPostSchema.partial())`При использовании с PATCH каждое поле становится необязательным, но имеет тот же набор правил. корневой уровень ` body(rule.array(...))`или ` body(rule.oneOf([...]))`, ctx.body — это целый массив или тип объединения. Не используйте ранее рассмотренный ввод ctx.body, если body() не подключен.

Не читайте поток req и не выполняйте JSON.parse самостоятельно — он может легко конфликтовать с ctx.body, проанализированным платформой, а квота не является единообразной.

## Ограничение JSON на уровне приложения

` WebApp.body.payload.maxSize `Ограничьте размер **всего сайта** JSON/текстового тела; пакеты слишком большого размера будут отклонены до проверки body() и будет возвращено **413**. Открытый API и веб-перехватчик общедоступной сети устанавливают здесь верхний предел, чтобы предотвратить исчерпание памяти. Схема уровня маршрутизации не может контролировать ситуацию, когда «анализ вообще не может быть завершен».

Откройте API/вебхук для предотвращения больших пакетов:

```typescript
new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  body: { // [!code focus:3]
    payload: { maxSize: '1mb' }, // [!code highlight]
  },
  mount: [routers('./src/routers')],
});
```

## Все тело массива

Некоторые клиенты напрямую создают JSON корневого уровня в массивы (идентификаторы пакетов, списки событий) вместо `{ items: [...] }`. существовать ` body()`Внутренняя биография ` rule.array(...)`Или всю схему, после прохождения теста ` ctx.body`Это тип массива.

Идентификатор пакета, тело массива веб-перехватчиков:

```typescript
router.post('/batch-delete', {
  mount: [body(rule.array(rule.int()))], // [!code highlight]
  action: async (ctx) => {
    ctx.send({ deleted: ctx.body.length });
  },
});
```

## одна из взаимоисключающих форм

Один и тот же URL-адрес может получить несколько «кликов». ` type`Branch» JSON, но в любой момент времени можно сопоставить только один из них. ` rule.oneOf([...])`Пусть валидатор пытается последовательно, и это будет легально, если линию пройдет ровно один; если оба пройдут успешно или ни один из них не соответствует стандарту, это будет **400**.

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

## СОЗДАТЬ С ПАТЧЕМ

Используйте полную схему для создания и ту же схему для частичных обновлений. `.partial()`: каждое поле в PATCH становится необязательным, а правила остаются такими же, как и в POST. нарисованный ` src/schemas/*.schema.ts`Наконец, маршрут ссылается только на одно определение, и измененные поля не нужно выравнивать в двух местах.

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
import { createPostSchema } from '../schemas/post.schema.js';

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
Пустой объект {} в частичном() также может пройти проверку — если «хотя бы одно поле должно быть изменено», проверьте еще раз в действии. Когда клиент забывает передать Content-Type, пустое тело может быть обработано как {}, а когда оно не является обязательным, будет молча «ничего не изменено».
:::

## С файлами

Аватар и вложения ` rule.file()`, подробности см. в [Загрузка файлов](/ru/web/attach):

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

| Метод письма | результат |
| --- | --- |
| `{ avatar: rule.file() }` | Один файл, имя поля = имя формы. |
| `{ photos: rule.array(rule.file()).length({ max: 5 }) }` | Для полей с одинаковым именем существует несколько частей, до 5. |
| Обертывание вложенных объектов ` rule.file()` | Обычно не соответствует именам мозаичных полей составного поля. |

MaxSize на уровне поля и formData приложения. **Что является более строгим**: при значении 413 необходимо проверить оба уровня конфигурации.

Если условие фильтра для большого раздела изменено на POST + body(), необходимо четко указать документ и стратегию кэширования и не принимать внешних обязательств на основе семантики GET.

## Дальше

- [Загрузка файлов](/ru/web/attach)
- [Ограничения ответа](/ru/web/response)
- [Запись веб-приложения](/ru/web/): квота на уровне всего сайта.