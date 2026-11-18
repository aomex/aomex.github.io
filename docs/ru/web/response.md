---
outline: deep
---

# Ограничение ответа

Объявите, «какие коды состояния могут быть возвращены и как выглядит тело успеха» для маршрута: повесьте ответ() в методе mount. Это не меняет способ отправки данных в мире, но сужает типы ctx.send/ctx.throw/ctx.redirect и записывает их в OpenAPI. Если вы объявите 200, но отправите(201), компилятор будет жаловаться — это сделано намеренно.

```typescript
import { rule } from '@aomex/common';
import { response, Router } from '@aomex/web';

export const router = new Router();

router.get('/me', { // [!code focus:19]
  mount: [
    response({ // [!code highlight]
      statusCode: 200,
      content: {
        id: rule.int(),
        name: rule.string(),
      },
    }),
    response({ statusCode: 404 }),
  ],
  action: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) {
      return ctx.throw(404, 'not found');
    }
    ctx.send({ id: user.id, name: user.name });
  },
});
```

Используйте throw(404) из-за нехватки ресурсов и отправляйте в случае успеха — не смешивайте его с send(404). Функция response() ограничена временем компиляции и документацией и не будет перепроверять тело отправки во время выполнения.

После зависания содержимого 200 ctx.send({ id, name }) должен соответствовать выводу валидатора. заявил ` response({ statusCode: 404 })`Наконец, ctx.throw(404,…) можно «легально экспортировать». **201**, остальные 2xx, кроме 200, должны **явно указать код состояния** при отправке; **204** используйте ctx.send(204), не добавляйте {}. **3xx** Перейдите к ctx.redirect(статус, URL). Вы можете вызывать функцию response() несколько раз и записывать состояния успеха и ошибки соответственно.

| код состояния | Как осуществляется общепринятая практика? |
| --- | --- |
| `200` | ` send(body)`или ` send(200, body)` |
| Другое 2xx | ` send(status, body)` |
| 204 и тд без кузова | ` send(status)` |
| 3хх | ` redirect(status, url)` |
| 4xx/5xx | ` throw(status, …)` |

## Создание ресурсов 201

**201** обычно используется для обозначения «вновь успешно созданный» в REST, а тело содержит такие поля, как идентификатор нового ресурса. Объявить в монтировании ` response({ statusCode: 201, content: ... })`, используется в действии ` ctx.send(201, body)`, тип и OpenAPI будут считать 201 легальным экспортом.

```typescript
import { body } from '@aomex/web';

router.post('/users', { // [!code focus:15]
  mount: [
    body({
      name: rule.string().trim().length({ min: 1 }),
    }),
    response({ // [!code highlight]
      statusCode: 201,
      content: { id: rule.int(), name: rule.string() },
    }),
    response({ statusCode: 400 }),
  ],
  action: async (ctx) => {
    const user = await createUser(ctx.body);
    ctx.send(201, { id: user.id, name: user.name });
  },
});
```

## Удаление успешно 204

Используйте **204 No Content**, если удаление прошло успешно и **нет необходимости возвращать JSON**. заявление ` response({ statusCode: 204 })`назад,` ctx.send(204)`правильно ли писать после сужения; не засовывай это в 204`{}`.

```typescript
import { params } from '@aomex/web';

router.delete('/users/:id', {
  mount: [
    params({ id: rule.int().min(1) }),
    response({ statusCode: 204 }), // [!code highlight]
    response({ statusCode: 404 }),
  ],
  action: async (ctx) => {
    const ok = await deleteUser(ctx.params.id);
    if (!ok) {
      return ctx.throw(404);
    }
    ctx.send(204);
  },
});
```

## Перенаправление 3xx

Короткие ссылки, перенаправления после входа в систему и **3xx** при перемещении старого URL-адреса на новое доменное имя, используемое в бизнесе. ` ctx.redirect(status, url)`Вместо почерка Location. Установите соответствующий ` response({ statusCode: 302 })`(или другой 3xx), редирект будет считаться законным выходом в этом типе.

```typescript
router.get('/go', {
  mount: [
    response({ statusCode: 302 }), // [!code highlight]
  ],
  action: async (ctx) => {
    ctx.redirect(302, 'https://example.com');
  },
});
```

## конверт с постраничным списком

Интерфейс списка всегда возвращает 200`{ total, items }` Такие фиксированные конверты, а не голые массивы. использовать `response({ statusCode: 200, content: { total, items: rule.array(...) } })` Совместите входные параметры пейджинга с [query()](/ru/web/query), и интерфейсная часть, и OpenAPI увидят одну и ту же форму.

```typescript
import { query } from '@aomex/web';

router.get('/users', { // [!code focus:22]
  mount: [
    query({
      page: rule.int().min(1).default(1),
      size: rule.int().min(1).max(50).default(20),
    }),
    response({ // [!code highlight]
      statusCode: 200,
      content: {
        total: rule.int(),
        items: rule.array({
          id: rule.int(),
          name: rule.string(),
        }),
      },
    }),
  ],
  action: async (ctx) => {
    const { page, size } = ctx.query;
    const { total, items } = await listUsers({ page, size });
    ctx.send({ total, items });
  },
});
```

Когда прикреплён только класс проверки 400 и форма поля не записана, текст часто выравнивается по глобальному formatError:

```typescript
response({ statusCode: 400 }),
```

Специальные типы мультимедиа, такие как SSE и обычный текст:

```typescript
response({
  statusCode: 200,
  contentType: 'text/event-stream', // [!code highlight]
  content: rule.string(),
}),
```

## Пропуск обёртки ответа

При включённом [envelope](/ru/web/envelope) код, который должен уйти **без оболочки**, помечайте на соответствующем `response()` флагом `skipEnvelope: true`. Затрагивается только `statusCode` этой записи; другие коды на том же маршруте оборачиваются как обычно. Учитывается и в рантайме, и в OpenAPI.

```typescript
router.get('/report.pdf', { // [!code focus:12]
  mount: [
    response({
      statusCode: 200,
      contentType: 'application/pdf',
      content: rule.string(),
      skipEnvelope: true, // [!code highlight]
    }),
    response({ statusCode: 404 }),
  ],
  action: async (ctx) => {
    ctx.send(await loadPdf());
  },
});
```

Для страниц документации и сырого OpenAPI JSON в action можно выставить `ctx.response.skipEnvelope = true` (безусловный пропуск). В бизнес-маршрутах лучше вариант выше, чтобы контракт не потерял код.

Без `response()` `ctx.send` всё равно работает; перед продом добавьте успех и типичные 400/404, иначе OpenAPI и типы «пустые». Объявили 200, а в action `send(201)` — TypeScript ругается; поправьте код или объявление `response()`.

## Дальше

- [Формат ошибки](/ru/web/errors) (4xx/5xx JSON с ответом)
- [Обёртка ответа](/ru/web/envelope) (внешний HTTP 200, единая оболочка; `skipEnvelope`)
- [Тело запроса](/ru/web/body)/[Строка запроса](/ru/web/query) (симметричная запись со стороны входа)
- [Генерация OpenAPI](/ru/openapi/)