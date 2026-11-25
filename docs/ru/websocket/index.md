---
outline: deep
---

# Вход WebSocket-приложения

Чат, статус заказа, совместный курсор — когда сервер сам пушит в браузер. Собери `WebsocketApp` как Web и повесь на **тот же** HTTP-порт. После подключения бизнес идёт по имени события. После записи заказа в БД можно из обычного HTTP-маршрута дернуть тот же `ws` и дотянуться до онлайн-клиентов.

Важно: доставка **best-effort**. `await ws.room(...).send(...)` значит лишь, что фреймворк отправил (или отдал Redis) — **не** что клиент точно получил. Нет авто-retry и офлайн-ящика. Важное — в БД; после reconnect клиент догоняет по HTTP.

## Зависимости и первый экземпляр

Нужно работающее [Web-приложение](/ru/web/). Добавь пакеты realtime:

```bash
pnpm add @aomex/websocket @aomex/websocket-ws-transport
```

`WebsocketApp` — в отдельном файле с `export`. HTTP, маршруты и Console импортируют **один** экземпляр — не `new` в каждом файле, иначе push не совпадёт с соединениями.

```typescript
// src/ws.ts
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';
import { logger } from '@/services/logger.service';

export const ws = new WebsocketApp({ // [!code focus:8]
  logger, // [!code highlight]
  language: { mode: 'fixed', language: 'zh-CN' },
  path: '/ws',
  transport: new WsTransport(),
  mount: [channels('./src/channels')], // [!code highlight]
});
```

`logger`, `language`, `transport` обязательны — без них не скомпилируется.

- `logger`: **тот же** `Logger`, что у Web / Console. Сюда падают сбои транспорта и ошибки fanout по комнатам.
- `language`: тексты фреймворка на соединении (ошибка handshake, причина close, лимиты / ошибки валидации в push). Здесь `fixed` — админка, интранет, один язык.
- `mount`: сначала `channels('./src/channels')`, аналог `routers` у Web. Каналы — [события](/ru/websocket/channel).

Для публичных клиентов — согласование по заголовку handshake, `dynamic` + `fallback`:

```typescript
language: {
  mode: 'dynamic', // [!code highlight]
  header: 'accept-language',
  fallback: 'zh-CN',
},
```

`header` по умолчанию `accept-language` (сортировка `q`); свой — `x-language`. Коды `zh-CN`, `en-US` (дефис).

::: tip
При `ws.room().send()` из **HTTP-маршрута** язык берётся из **этого HTTP-запроса**, а не из языка handshake давнего WS-соединения.
:::

## Повесить на HTTP-порт

WebSocket сам порт не слушает — upgrade через `http.Server` Web. Вход: не только `app.listen(3000)`, а `app.http({})` → `ws.attach` → `listen`.

```typescript
// src/web.ts — точка входа процесса
import { routers, WebApp } from '@aomex/web';
import { services } from '@/services';
import { ws } from '@/ws';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [routers('./src/routers')],
});

const server = app.http({}); // [!code focus:3]
ws.attach(app, server); // [!code highlight]
server.listen(3000, () => {
  console.log('HTTP + WebSocket 已启动');
});
```

`attach` **до** `listen`. Один `ws` — один attach, повтор бросит ошибку. При shutdown фреймворк гасит HTTP и WS вместе — свою вторую очистку писать не нужно.

::: warning
Не вызывай `ws.attach(...)` на верхнем уровне `src/ws.ts`. Console тоже импортирует `ws` — attach при import в каждом процессе, push разъедется.
:::

Запуск:

```bash
node --import tsx/esm --watch src/web.ts
```

Проверка в консоли браузера (путь `/ws`):

```typescript
const socket = new WebSocket('ws://localhost:3000/ws');
socket.onopen = () => {
  socket.send(JSON.stringify({ event: 'ping', data: {} }));
};
socket.onmessage = (ev) => {
  console.log(ev.data);
};
```

Без Channel сообщение может тихо пропасть (`unknownEvent: 'ignore'`). Сначала заведи каналы, потом обработчики.

## Куда подключается клиент

`path` — URL подключения. По умолчанию `/ws`; при смене меняй адрес:

```typescript
path: '/realtime',
// браузер: new WebSocket('ws://localhost:3000/realtime')
```

Для Socket.IO: `io('http://localhost:3000', { path: '/realtime' })`.

`transport` **обязателен** — handshake и кадры. Для старта `new WsTransport()`; Socket.IO — замена одной строки, Channel без переделки — [транспорт](/ru/websocket/transport).

`hub` **необязателен**. Память по умолчанию — комнаты только в **текущем процессе**. Несколько реплик или push из Console на браузеры Web — Redis Hub — [Hub](/ru/websocket/hub).

Транспорт и Hub независимы. С Socket.IO не вешай официальный Redis adapter Socket.IO — комнаты только hub aomex.

## verify и глобальный middleware

На upgrade `verify` — грубый фильтр: обычный Web `request`, Cookie, заголовки, IP. `true` — ок; `false` или код HTTP (например `401`) — отказ handshake. Права на конкретное событие — mount Channel.

```typescript
import { logger } from '@/services/logger.service';

export const ws = new WebsocketApp({
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  transport: new WsTransport(),
  verify: (request) => { // [!code focus:3]
    return request.cookies['sid'] ? true : 401;
  },
  mount: [channels('./src/channels')],
});
```

`mount` — луковица как у `WebApp.mount`. Обычно **в конце** `channels(...)`, перед ним access log, rate limit, abuse. Только `middleware.socket` / `middleware.mixin`, не HTTP-middleware.

```typescript
mount: [
  // access log, rate limit… см. «Частые middleware» в сайдбаре
  channels('./src/channels'),
],
```

## Отладка: неизвестные события и размер кадра

Незарегистрированное имя — `unknownEvent: 'ignore'`, тихо. На отладке `'error'` — push `event: 'error'`, сразу видно опечатку. В проде чаще оставляют `ignore`.

```typescript
unknownEvent: 'error', // на время отладки
```

`maxPayload` — макс. байт кадра, default 1 MiB. Слишком большое жрёт память, низкий уровень рвёт соединение. Поднять для большого JSON / base64; для чата default хватает.

```typescript
maxPayload: 256 * 1024, // 256 KiB, чуть жёстче
```

## Онлайн-метрики

`onMetric` — колбэк при изменении онлайна и исходах входящих. Ошибка в колбэке — только warn, трафик не стопорится.

```typescript
import { logger } from '@/services/logger.service';

export const ws = new WebsocketApp({
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  transport: new WsTransport(),
  mount: [channels('./src/channels')],
  onMetric: (e) => { // [!code focus:5]
    if (e.type === 'online') {
      console.log('当前在线', e.online);
    }
  },
});
```

Или свой интервал — снимок **этой машины** (online, rooms), не весь кластер:

```typescript
setInterval(async () => {
  const s = await ws.stats();
  console.log(s.online, s.rooms);
}, 10_000);
```

## Push из HTTP-маршрута

Типичный прод: API пишет в БД → push онлайну → HTTP-ответ как обычно.

При connect фреймворк сам кладёт в комнату `client.id` (push только на это соединение). Бизнес-комнаты (лобби, id заказа) — `join` в Channel, иначе `room('lobby').send` некому.

```typescript
// src/routers/order.ts
import { Router } from '@aomex/web';
import { ws } from '@/ws';

export const router = new Router();

router.post('/orders', { // [!code focus:8]
  action: async (ctx) => {
    const order = await createOrder(/* ... */);
    await ws.room(`order:${order.id}`).send('order.updated', order); // [!code highlight]
    ctx.send(order);
  },
});
```

Варианты отправки:

```typescript
// все онлайн
await ws.all.send('system.notice', { text: '维护 5 分钟' });

// один client.id (точка-точка)
await ws.room(clientId).send('dm', { text: 'hi' });

// всем, кроме одного
await ws.all.send('notice', { text: '...' }, { except: clientId });
```

`except` — объект соединения с `id` или строка id. Имя комнаты не пустое и без `\0`, иначе throw.

::: tip
Память hub **не выходит за процесс**. Console с `import { ws }` и `send` в другом процессе, чем Web — браузер не получит. Один Redis Hub на обоих — [Hub](/ru/websocket/hub).
:::

## Web, Console рядом

| | Web | WebSocket | Console |
| --- | --- | --- | --- |
| Сопоставление | метод + путь | имя события | имя команды |
| Ввод | query / body / params | `payload()` | `options()` |
| Выход | `response()` | `emit()` | — |
| Жизнь процесса | listen | attach к тому же Server | `run` и выход |

БД и почта — [services](/ru/core/service); realtime — Channel; «после записи push» — маршрут или Console с `ws.room`.

## Дальше

- [Channel](/ru/websocket/channel) — событие с ответом `pong`
- [payload](/ru/websocket/payload) / [emit](/ru/websocket/emit)
- [Транспорт](/ru/websocket/transport) — нужен ли Socket.IO
- [Hub](/ru/websocket/hub) — реплики и Console