---
outline: deep
---

# Формат ошибок

Чтобы `ctx.throw` по всему сайту (или модулю) давал единый JSON, а не текст по умолчанию: повесь `formatError` в `mount`, задай `handler` для итогового body и `content` для типов и OpenAPI. Меняй форму здесь, а не в `app.on('error')` — поздно, легко конфликтовать с уже отправленным ответом.

```typescript
import { rule } from '@aomex/common';
import { formatError, routers, WebApp } from '@aomex/web';

new WebApp({
  // services / logger / language / proxyIP — см. [вход приложения](/ru/web/)
  mount: [
    formatError({ // [!code focus:13]
      content: { // [!code highlight]
        code: rule.string(),
        message: rule.string(),
      },
      handler(err) {
        return {
          code: err.code ?? 'ERROR',
          message: err.message,
        };
      },
    }),
    routers('./src/routers'),
  ],
});
```

Вешай `formatError` **снаружи и выше** `routers`, чтобы throw с любого маршрута (если не пойман ближе) попадал в этот handler.

Форма возврата handler должна совпадать с `content`. При `ctx.throw(403, { code: 'FORBIDDEN' })` код чаще в `err.code`, текст — в очищенном `err.message`. Без `statusCodes` этот слой берёт **все** 4xx / 5xx. Если на маршруте `response({ statusCode: 400 })` без `content`, генерация документации часто заимствует форму ошибки внешнего formatError. Без formatError клиент получает текст ошибки по умолчанию.

При перехвате обычно сбрасываются заголовки текущего ответа, ставится статус по коду ошибки и отправляется новое body. Не клади в handler `err.raw`, стек, SQL — наружу только очищенная информация.

## Внутренний конверт модуля

Глобальный formatError задаёт форму по умолчанию. Для **/admin** или поддомена API с другими полями (`error` / `detail` вместо `code` / `message`) — ещё один слой в `Router({ mount: [formatError(...)] })`. Внутреннее кольцо ловит throw раньше; префикс — внутренняя форма, остальное — внешняя.

Для /admin с другими именами полей — слой внутри Router:

```typescript
import { formatError, Router } from '@aomex/web';

const adminRouter = new Router({ // [!code focus:18]
  prefix: '/admin',
  mount: [
    formatError({ // [!code highlight]
      content: {
        error: rule.string(),
        detail: rule.string().optional(),
      },
      handler(err) {
        return {
          error: err.code ?? 'ADMIN_ERROR',
          detail: err.message,
        };
      },
    }),
    auth.authenticate('bearer'),
  ],
});
```

В луке **внутри ловит раньше**: `/admin/*` — внутренняя форма, остальные маршруты — глобальный fallback.

## Частичный охват через statusCodes

`statusCodes` ограничивает, какие HTTP-коды обрабатывает **этот** formatError (часто только 400, 422 и прочая валидация). Остальные 4xx / 5xx всплывают наружу — удобно, когда «валидация — единый JSON, 403 — глобальный конверт».

Только ошибки валидации здесь, остальное — снаружи:

```typescript
formatError({ // [!code highlight]
  statusCodes: [400, 422],
  content: {
    code: rule.string(),
    message: rule.string(),
  },
  handler(err) {
    return {
      code: err.code ?? 'VALIDATION',
      message: err.message,
    };
  },
}),
```

## Вместе с throw в маршрутах

В маршруте `ctx.throw(status, …)` завершает запрос и уходит в цепочку ошибок: нет ресурса — **404**, бизнес-проверка — **400**, права — **403**. Второй аргумент — строка или объект с `code`; handler formatError собирает код и текст в `content`.

```typescript
ctx.throw(404);
ctx.throw(400, 'name required');
ctx.throw(403, { code: 'FORBIDDEN' });
```

Если в action уже успели записать заголовки или body и потом throw — пусть formatError заменит целиком, не собирай половину JSON ошибки вручную.

Если нужна обёртка `{ success, data, statusCode }` с внешним HTTP 200 — см. [обёртку ответа](/ru/web/envelope) (часто вместе с formatError).

## Дальше

- [Обёртка ответа](/ru/web/envelope) (единая оболочка и HTTP 200)
- [Ограничение ответа](/ru/web/response) (400/404 и т.д. на маршруте)
- [Вход приложения](/ru/web/) (services, logger, language и др.)
- [WebApp.language](/ru/web/#language) (язык валидации и ошибок)