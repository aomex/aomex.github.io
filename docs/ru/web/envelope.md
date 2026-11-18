---
outline: deep
---

# Оболочка ответа

Многие команды хотят использовать одну и ту же оболочку JSON как для успеха, так и для неудачи (например,`{ success, data, statusCode }`), внешний HTTP имеет фиксированное значение **200**, а реальный бизнес-код записывается в тело. ` WebApp.envelope`Вот что он делает: перед фактической записью ответа исходное тело и код состояния помещаются в слой в соответствии с объявленной вами структурой.

Маршрутизация остается прежней ` ctx.send(201, …)`/` ctx.throw(400, …)`; Оболочка происходит на этапе очистки, поэтому вам не нужно вручную писать оболочку для каждого действия.

```typescript
import { rule } from '@aomex/common';
import { envelope, formatError, routers, WebApp } from '@aomex/web';

new WebApp({
  // services / logger / language / proxyIP —— 见 [应用入口](/ru/web/)
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

-` ctx.send(201, { id: 1 })`→ HTTP **200**, тело аналогичное `{ success: true, statusCode: 201, data: { id: 1 } }`
-` ctx.throw(400, …)`(с formatError) → HTTP **200**,` success: false `,` data `это ошибка JSON; настоящие **400** находятся в` statusCode `канавка

Клиенту необходимо проверить, успешно ли выполнено тело, и он не может просто просмотреть код состояния HTTP (за исключением перенаправлений и ответов без содержимого, см. ниже).

## Встроенный слот

` content `является деревом объявлений, листьями могут быть только встроенные слоты или` envelope.slot `, обычные объекты также могут быть вложенными. Не набивайте это напрямую` rule.string()`—— Нет источника значений времени выполнения.

| слот | значение времени выполнения |
| --- | --- |
| ` envelope.success ` | Исходный код состояния`< 400`(Считается ли это успешным в бизнесе) |
| ` envelope.payload ` | Тело ответа перед обработкой (json/string/null) |
| ` envelope.statusCode ` | Код состояния HTTP перед обстрелом (внешний уровень после записи все еще равен 200) |

Имя поля` data `,` result `все еще` payload `Вам решать: к какому ключу прикрепить встроенный слот.

## Пользовательские слоты и вложение

Если вам нужны фиксированные или производные значения, такие как номера версий и поля отслеживания, используйте` envelope.slot(schema, get)`:` schema `для OpenAPI,` get `только чтение`{ success, payload, statusCode }`.

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

` get ` Не полагайтесь на другие контексты, такие как ctx и сервисы — на этапе оболочки можно увидеть только три вышеуказанные переменные.

## Связь с formatError и ответом()

- **[formatError](/ru/web/errors)**: Первая установка ` ctx.throw ` Соберите унифицированную ошибку JSON, снова как ` envelope.payload ` Положить в дело. Рекомендуется настраивать их вместе; если formatError не смонтирован, в полезные данные также будет включена стандартная текстовая ошибка (преобразованная в строковое значение JSON).
- **[response()](/ru/web/response)**: по-прежнему объявляет форму тела успеха/неудачи по «реальному» коду состояния; обёртка не меняет, как в action вызываете send / throw, только внешнюю оболочку перед flush. В OpenAPI ветки успеха/ошибки сводятся к схеме обёртки под 200 (см. ниже). Чтобы **не оборачивать** отдельные коды, укажите на соответствующем `response({ skipEnvelope: true })` (следующий раздел).

Продолжайте писать `send(201)`, `throw(404)` — типы и объявления маршрута не нужно переписывать под «всегда 200».

::: tip
Если тело уже JSON-строка и `Content-Type` — `application/json` (например, после ручного `JSON.stringify` в middleware), фреймворк сначала сделает `JSON.parse`, затем запишет в `envelope.payload`, чтобы в `data` не оказалась одна длинная экранированная строка.
:::

## Когда обёртка не применяется

Следующий ответ записывается **как есть**, без оболочки или изменен на 200:

| Состояние | причина |
| --- | --- |
| **3xx** Перенаправление | Семантику, такую ​​как местоположение, нельзя изменить на оболочку JSON. |
| **204 / 205 / 304** и другие коды состояния без содержимого. | Нет тела самого по себе |
| **SSE**(` text/event-stream `) | Протокол потоковой передачи кадров не может буферизовать весь пакет в JSON. |
| **Буфер/поток** тело | Двоичная или потоковая загрузка, не подходит для JSON. |

Обычные json / string / null (в том числе неявный 404 без send) оборачиваются.

При [ETag](/ru/plugins/etag): если обёртка перезаписывает body, фреймворк **снимает исходный ETag**, чтобы хеш не относился к содержимому до обёртки.

## Явный пропуск обёртки

При включённом envelope отдельные выходы иногда должны идти **как есть** (скачивания, старые клиенты, HTML-документация). Два варианта:

**В бизнес-маршрутах предпочтительно `response({ skipEnvelope: true })`**: пропускается только **этот** `statusCode` в объявлении; остальные коды по-прежнему в обёртке. Рантайм и OpenAPI совпадают.

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

Здесь успешный 200 — голый CSV; 400 при ошибке валидации всё ещё в глобальной оболочке (через formatError в payload).

На одном маршруте можно вызвать `response()` несколько раз — у каждого свой `skipEnvelope`: например, успех в оболочке, ошибка «голая», или наоборот.

**Инфраструктурные ответы** (страницы Swagger / Redoc, сырой OpenAPI JSON) в action задайте `ctx.response.skipEnvelope = true`: безусловный пропуск при записи, любой финальный код. Для бизнес-API лучше `response({ skipEnvelope })`, чтобы документация зафиксировала код.

```typescript
action: async (ctx) => {
  ctx.response.skipEnvelope = true; // [!code highlight]
  ctx.send(rawOpenapiDocument);
},
```

## OpenAPI

Передайте в `generateOpenapi` / Console `openapi()` **тот же настроенный `WebApp` (`app`)** — генератор читает `envelope` с `app`: после инъекций `response` / `formatError` сводит в документе 2xx и 4xx·5xx·default **к схеме обёртки под HTTP 200** (для успеха/ошибки часто `oneOf`, `success` — `true` / `false`); **оставляет** 3xx, 204 и прочие коды без тела, а также коды из `response({ skipEnvelope: true })` — как при пропуске в рантайме.

Если у одной operation есть и «skip» 200, и ветки с обёрткой, для ответа `200` и `application/json` генератор соберёт `oneOf` из голой и обёрнутой схемы; другие media (например `text/html`) не трогает.

`envelope.description` попадёт в описание сведённого ответа `200`. Не передавайте второй массив `mount` и не забывайте `app` — иначе в контракте «201 + голое тело», а в проде «200 + оболочка». Подробнее: [Генерация OpenAPI](/ru/openapi/).

## Дальше

- [Формат ошибки](/ru/web/errors):` formatError ` Оборудованная полезная нагрузка
- [Ограничения ответа](/ru/web/response): объявить реальный код статуса и внутреннее содержимое маршрута.
- [Генерация OpenAPI](/ru/openapi/): Как контракт сканирует маршрут?
- [Запись веб-приложения](/ru/web/):` WebApp` Другие обязательные поля