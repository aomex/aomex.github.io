---
outline: deep
---

# Обёртка тела ответа

Многим командам нужна **одна JSON-оболочка** и для успеха, и для ошибки (например `{ success, data, statusCode }`), с внешним HTTP **200**, а реальным кодом внутри body. `WebApp.envelope` делает это перед записью ответа.

В маршрутах по-прежнему `ctx.send(201, …)` / `ctx.throw(400, …)`; обёртка на этапе flush — не пиши оболочку в каждом action.

```typescript
import { rule } from '@aomex/common';
import { envelope, formatError, routers, WebApp } from '@aomex/web';

new WebApp({
  // services / logger / language / proxyIP — см. [вход приложения](/ru/web/)
  envelope: { // [!code focus:7]
    content: {
      success: envelope.success, // [!code highlight]
      statusCode: envelope.statusCode,
      data: envelope.payload,
    },
  },
  mount: [
    formatError({
      content: { code: rule.string(), message: rule.string() },
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

После настройки:

- `ctx.send(201, { id: 1 })` → HTTP **200**, body вроде `{ success: true, statusCode: 201, data: { id: 1 } }`
- `ctx.throw(400, …)` (с formatError) → HTTP **200**, `success: false`, в `data` — JSON ошибки; реальный **400** — в слоте `statusCode`

Клиент смотрит на успех в body, **не только на HTTP-статус** (кроме редиректов и ответов без тела, ниже).

## Встроенные слоты

`content` — дерево объявлений; листья — только встроенные слоты или `envelope.slot`, можно вкладывать обычные объекты. Не вставляй `rule.string()` напрямую — нет источника значения в рантайме.

| Слот | В рантайме |
| --- | --- |
| `envelope.success` | Исходный код `< 400` (успех по бизнес-логике) |
| `envelope.payload` | Тело до обёртки (json / string / null) |
| `envelope.statusCode` | Исходный HTTP-код (после записи снаружи всё равно 200) |

Имя поля (`data`, `result`, `payload`) — на твой выбор: повесь встроенный слот на нужный ключ.

## Свои слоты и вложенность

Для версии, trace и т.п. — `envelope.slot(schema, get)`: `schema` для OpenAPI; `get(vars, ctx)` — первый аргумент `{ success, payload, statusCode }`, второй — контекст запроса (`WebContext` + `WebApp.Props`, как в `onError` — pathname, headers, services).

Только константа — можно без параметров:

```typescript
envelope: {
  content: {
    meta: {
      ok: envelope.success,
      code: envelope.statusCode,
      version: envelope.slot(rule.string(), () => '1.0'), // [!code highlight]
    },
    result: envelope.payload,
  },
},
```

Значение из текущего запроса — второй аргумент `ctx`:

```typescript
envelope: {
  content: {
    success: envelope.success,
    statusCode: envelope.statusCode,
    data: envelope.payload,
    path: envelope.slot(rule.string(), (_vars, ctx) => { // [!code highlight]
      return ctx.request.pathname;
    }),
  },
},
```

Возврат `get` должен совпадать с типом `schema`; лишние поля в закрытом объекте дадут ошибку типов.

## Связь с formatError и response()

- **[formatError](/ru/web/errors)**: сначала единый JSON ошибки из `ctx.throw`, потом в оболочку как `envelope.payload`. Рекомендуется вместе; без formatError дефолтный текст ошибки тоже попадёт в payload (как JSON-строка).
- **[response()](/ru/web/response)**: по-прежнему объявляешь форму тела по «настоящему» статусу; обёртка не меняет send/throw в action, только внешнюю запись. В OpenAPI ветки успеха/ошибки схлопываются в schema обёртки при 200 (ниже). Чтобы **не** оборачивать отдельные коды — `response({ skipEnvelope: true })` (следующий раздел).

В коде оставляй `send(201)`, `throw(404)` — типы и объявления маршрутов не переписывай под «всегда 200».

::: tip
Если при обёртке body уже JSON-строка и `Content-Type` — `application/json` (например ручной `JSON.stringify` в middleware), фреймворк сначала `JSON.parse`, затем кладёт в `envelope.payload`, чтобы в `data` не оказался экранированный текст.
:::

## Когда обёртки нет

Эти ответы пишутся **как есть**, без оболочки и без принудительного 200:

| Случай | Почему |
| --- | --- |
| **3xx** редирект | Семантика Location не в JSON-оболочке |
| **204 / 205 / 304** и т.п. без тела | Тела нет |
| **SSE** (`text/event-stream`) | Поток кадров, не один JSON |
| Тело **Buffer / Stream** | Бинарь и стрим, не JSON-обёртка |

Обычные json / string / null (включая дефолтный 404 без send) оборачиваются.

С [ETag](/ru/plugins/etag): после смены body обёрткой фреймворк **снимает ETag**, чтобы хеш не относился к содержимому до обёртки.

## Явный пропуск обёртки

Сайт с envelope, но отдельные выходы — **голый ответ** (скачивание, старые клиенты, HTML):

**В бизнес-маршрутах — `response({ skipEnvelope: true })`**: пропуск только для этого `statusCode`; остальное оборачивается; runtime и OpenAPI согласованы.

```typescript
import { rule } from '@aomex/common';
import { response, Router } from '@aomex/web';

export const router = new Router();

router.get('/export.csv', { // [!code focus:14]
  mount: [
    response({
      statusCode: 200,
      contentType: 'text/csv',
      content: rule.string(),
      skipEnvelope: true, // [!code highlight]
    }),
    response({ statusCode: 400 }),
  ],
  action: async (ctx) => {
    ctx.send(await buildCsv());
  },
});
```

Здесь успех 200 — голый CSV; 400 при валидации — общая оболочка (через formatError в payload).

Несколько `response()` на маршруте — у каждого свой `skipEnvelope`.

**Инфраструктура** (страницы Swagger / Redoc, голый OpenAPI JSON): в action `ctx.response.skipEnvelope = true` — безусловный пропуск для этой записи. Для API лучше `response({ skipEnvelope })`.

```typescript
action: async (ctx) => {
  ctx.response.skipEnvelope = true; // [!code highlight]
  ctx.send(rawOpenapiDocument);
},
```

## OpenAPI

При передаче в `generateOpenapi` / Console `openapi()` **того же `WebApp` (`app`) с envelope** генератор читает обёртку с `app`: после прочих `response` / formatError документация схлопывает 2xx и 4xx·5xx·default в schema обёртки при HTTP 200 (часто `oneOf`, `success` true/false); **сохраняются** 3xx, 204 и коды из `response({ skipEnvelope: true })` — как в runtime.

Если в operation есть и «skip 200», и оборачиваемые ветки — для этого `200` в `application/json` — `oneOf` голого и обёрнутого schema; другие media без изменений.

`envelope.description` попадает в описание схлопнутого `200`. Не дублируй `mount` вручную и не забывай `app` — иначе в контракте «201 + голое тело», в проде «200 + оболочка». См. [генерацию OpenAPI](/ru/openapi/).

## Дальше

- [Формат ошибок](/ru/web/errors): formatError и payload обёртки
- [Ограничение ответа](/ru/web/response): реальные статусы и внутренний content
- [Генерация OpenAPI](/ru/openapi/)
- [Вход Web-приложения](/ru/web/): прочие обязательные поля `WebApp`