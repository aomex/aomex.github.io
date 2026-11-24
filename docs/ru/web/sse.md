---
outline: deep
---

# Серверный push SSE

Сделайте GET-интерфейс «сервер постоянно пушит, браузер слушает через EventSource»: в action вызовите `ctx.sse()`, через `stream` или `send` отдавайте события. Подходит для уведомлений, прогресса, котировок; для двустороннего хаоса кадров смотрите WebSocket.

```typescript
import { Router } from '@aomex/web';

export const router = new Router();

router.get('/events', { // [!code focus:13]
  action: async (ctx) => {
    const sse = ctx.sse({ retry: 3_000 }); // [!code highlight]
    await sse.stream(async (emit, signal) => {
      for await (const item of watchEvents({
        after: sse.lastEventId,
        signal,
      })) {
        emit({ id: String(item.id), event: 'item', data: item });
      }
    });
  },
});
```

Предпочитайте `stream`: при отключении клиента `signal` abort'ится, конец итерации сам закрывает, меньше ручных close / таймеров.

`ctx.sse()` и `ctx.response.sse()` эквивалентны; вызывайте, **пока заголовки ответа ещё не записаны**, иначе сразу ошибка. SSE занимает весь ответ — в конце того же маршрута не делайте `ctx.send` JSON. После открытия статус 200, Content-Type: text/event-stream. Объектный `data` у emit / send сериализуется в JSON; `lastEventId` из заголовка запроса, при первом подключении чаще `undefined`.

## heartbeat и retry

Долгие соединения браузера reverse proxy часто режет как idle. `heartbeat` периодически шлёт comment-строки keep-alive (часто ~15 s; локально коротко — `heartbeat: false`). `retry` — через сколько миллисекунд клиенту советуют переподключиться (для потока уведомлений часто `3000`). В проде через Nginx / CDN сверьте оба.

```typescript
const sse = ctx.sse({
  heartbeat: 10_000,
  retry: 3_000,
});
```

## Поля одного события

Каждый `send` / `emit` может нести имя event, id, опциональный одноразовый retry и payload `data`. Объектный data сериализуется в JSON автоматически; при **id** браузер при переподключении шлёт `Last-Event-ID` — удобно продолжать. Несколько типов событий (`job` / `progress` / `ready`) фронт слушает по имени `event`.

```typescript
sse.send({ data: { hello: 'world' } });
sse.send({ event: 'ready' });
sse.send({
  id: '42', // [!code highlight]
  event: 'job',
  retry: 5_000,
  data: 1,
});
```

## stream, продолжение и завершение

`stream` оборачивает «читаем upstream и emit» в жизненный цикл: при отключении клиента **signal** abort (передайте в Redis-подписку, watch очереди), конец итерации закрывает — без ручных таймеров и close. `lastEventId` из заголовка — продолжайте после этого события; в `onClose` снимайте подписки, пишите аудит; по окончании задачи можно `close()` (`stream` по завершении вызовет сам).

```typescript
await sse.stream(async (emit, signal) => { // [!code focus:8]
  const after = sse.lastEventId;
  sse.onClose(() => {
    subscription.unsubscribe();
  });
  for await (const item of watchEvents({ after, signal })) {
    emit({ id: String(item.id), event: 'item', data: item });
  }
});
```


Если соединение уже закрыто или не writable, `send` молча игнорируется — не считайте это «гарантированной доставкой». Для продолжения после обрыва давайте событиям стабильный id, иначе `lastEventId` не совпадёт и переподключение начнётся с начала.

::: warning
Долгое соединение через Nginx и т.п.: кроме `X-Accel-Buffering: no` фреймворка всё равно сверьте heartbeat и таймауты буфера reverse proxy, иначе часто режут как idle.
:::

## Вместе с response() и OpenAPI

OpenAPI должен знать, что выход этого GET — `text/event-stream`, поэтому в mount повесьте `response({ contentType: 'text/event-stream', ... })`. Это только для доки и типов, **не заменяет** запись кадров через `ctx.sse()` в action.

```typescript
import { rule } from '@aomex/common';
import { response } from '@aomex/web';

response({
  statusCode: 200,
  contentType: 'text/event-stream', // [!code highlight]
  content: rule.string(),
  description: 'SSE 事件流',
});
```

Только дока и подсказки типов — **не замена** протоколу кадров `ctx.sse()`. Compress обычно пропускает text/event-stream, см. [Compress](/ru/plugins/compress).

EventSource только GET; при кросс-сайте с cookie настройте [CORS](/ru/plugins/cors).

## Дальше

- [Ограничение ответа](/ru/web/response) (объявление contentType потокового выхода)
- [Обзор ввода-вывода](/ru/web/) (монтирование вместе с другим Web middleware)
- [Compress](/ru/plugins/compress) (не сломайте поток событий)
