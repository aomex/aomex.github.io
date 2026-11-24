---
outline: deep
---

# Точка входа WebSocket-приложения

Чат, статус заказа, совместный курсор — всё, что сервер должен сам пушить в браузер. WebSocket-приложение как раз для этого: вы создаёте `WebsocketApp` почти как Web-приложение, затем вешаете его на **тот же** HTTP-порт. Клиент подключается и ходит в бизнес по «имени события»; после успешной записи заказа в БД вы можете из обычного HTTP-маршрута вызвать тот же `ws` и отправить сообщение тем, кто ещё онлайн.

Сразу одно правило: доставка — **best-effort**. Когда `await ws.room(...).send(...)` завершился, фреймворк уже отдал сообщение наружу (или в Redis) — это **не** гарантия, что получатель его увидел, и нет автоповтора или офлайн-ящика. Важные данные всё равно пишите в БД; после переподключения клиент догоняет состояние по HTTP.

## Установите зависимости и создайте один общий экземпляр

Предположим, у вас уже есть рабочее [Web-приложение](/ru/web/). Добавьте пакеты для realtime:

```bash
pnpm add @aomex/websocket @aomex/websocket-ws-transport
```

`WebsocketApp` держите в отдельном файле и `export`ьте его. HTTP-вход, маршруты и Console-команды импортируют **этот** экземпляр — **не** делайте `new` в каждом файле, иначе пуши не попадут в те же соединения.

```typescript
// src/ws.ts
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';
import { services } from './services/index.js';

export const ws = new WebsocketApp({ // [!code focus:8]
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  path: '/ws',
  transport: new WsTransport(),
  mount: [channels('./src/channels')], // [!code highlight]
});
```

`logger`, `language` и `transport` обязательны; без них компилятор остановит вас.

- `logger`: передайте **тот же** `services.logger`, что и в Web / Console. Сюда попадут ошибки инициализации транспорта и сбоев fan-out по комнатам.
- `language`: язык служебных текстов на этом соединении (сбой handshake, причина закрытия неверной рамки, ответ при лимите / ошибке валидации). Выше — режим `fixed`: для админки, внутренней сети и одноязычного продукта проще всего.
- `mount`: сначала повесьте `channels('./src/channels')` — то же, что `routers('./src/routers')` в Web. Как писать Channel: [маршрутизация событий](/ru/websocket/channel).

Если публичный мультиязычный клиент согласует язык по заголовку handshake, переключитесь на `dynamic` и укажите `fallback`:

```typescript
language: {
  mode: 'dynamic', // [!code highlight]
  header: 'accept-language',
  fallback: 'zh-CN',
},
```

`header` по умолчанию — `accept-language` (с сортировкой по `q`); свой заголовок приложения можно задать как `x-language`. Коды языка пишите как `zh-CN`, `en-US` (через дефис).

::: tip
Когда вы вызываете `ws.room().send()` из **HTTP-маршрута**, язык берётся из **этого HTTP-запроса**, а не из языка handshake длинного соединения.
:::

## Подвесьте к HTTP-порту

WebSocket не открывает свой listen-порт — он делает upgrade того же `http.Server`, что и Web. Поэтому точка входа процесса — не один `app.listen(3000)`: сначала `app.http({})` → `ws.attach` → затем `listen`.

```typescript
// src/web.ts —— настоящая точка входа процесса
import { routers, WebApp } from '@aomex/web';
import { services } from './services/index.js';
import { ws } from './ws.js';

const app = new WebApp({
  services,
  logger: services.logger,
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

`attach` должен быть **до** `listen`; один и тот же `ws` можно attach только один раз — повторный вызов сразу бросит ошибку. При сигнале остановки фреймворк закроет HTTP и опустошит WebSocket-соединения — два набора cleanup писать не нужно.

::: warning
Не вызывайте `ws.attach(...)` на верхнем уровне модуля `src/ws.ts`. Console-команды тоже импортируют `ws`: один import снова пройдёт attach, два процесса разъедутся, пуши сломаются.
:::

Запуск:

```bash
node --import tsx/esm --watch src/web.ts
```

В консоли браузера проверьте связь (путь по умолчанию `/ws`):

```typescript
const socket = new WebSocket('ws://localhost:3000/ws');
socket.onopen = () => {
  socket.send(JSON.stringify({ event: 'ping', data: {} }));
};
socket.onmessage = (ev) => {
  console.log(ev.data);
};
```

Пока нет соответствующего Channel, сообщение могут тихо отбросить (по умолчанию `unknownEvent: 'ignore'`). Сначала поднимите канал, потом пишите обработчики.

## Куда подключается клиент и какой протокол

`path` задаёт URL для браузера. По умолчанию `/ws`; если меняете — меняйте и адрес:

```typescript
path: '/realtime',
// 浏览器：new WebSocket('ws://localhost:3000/realtime')
```

Для клиента Socket.IO: `io('http://localhost:3000', { path: '/realtime' })`.

`transport` **обязателен**: handshake, upgrade и каждая рамка. Для локального старта хватит `new WsTransport()`; позже на Socket.IO меняете одну строку, бизнес Channel не трогаете — см. [транспорт](/ru/websocket/transport).

`hub` **можно не указывать**. По умолчанию — memory Hub: комнаты и broadcast работают только в **текущем процессе**, для одномашинной разработки достаточно. На нескольких репликах или когда Console тоже пушит людям на Web — поставьте Redis Hub: [мультимашинный Hub](/ru/websocket/hub).

Это независимые оси: смена транспорта ≠ смена Hub; мультимашина — только Hub. Если взяли Socket.IO, **не** вешайте его собственный Redis adapter — комнаты знает только Hub aomex.

## Грубый фильтр handshake и глобальный middleware

Перед upgrade можно повесить `verify`: аргумент — обычный Web-запрос (Cookie, заголовки, IP). Верните `true`, чтобы пустить; `false` или HTTP-код (например `401`) — отказать в handshake. Права на конкретное событие лучше вешать в mount Channel.

```typescript
export const ws = new WebsocketApp({
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  transport: new WsTransport(),
  verify: (request) => { // [!code focus:3]
    return request.cookies['sid'] ? true : 401;
  },
  mount: [channels('./src/channels')],
});
```

`mount` — как у `WebApp.mount`, onion-очередь. Обычно **в конце** — `channels(...)`, раньше — access log, rate limit, abuse. Сюда только `middleware.socket` / `middleware.mixin`, не HTTP-only middleware.

```typescript
mount: [
  // 访问日志、限速……见侧栏「常用中间件」
  channels('./src/channels'),
],
```

## Отладка: неизвестные события и размер рамки

Если клиент шлёт незарегистрированное имя события, по умолчанию `unknownEvent: 'ignore'` — тихий дроп. На этапе стыковки можно `'error'`: фреймворк ответит рамкой `event: 'error'`, фронт сразу увидит опечатку; в проде чаще оставляют `ignore`.

```typescript
unknownEvent: 'error', // 联调时打开
```

`maxPayload` — максимум байт на одну рамку, по умолчанию 1MiB. Слишком большой пакет съедает память, низкий уровень просто рвёт соединение. Увеличивайте только если реально нужны большие JSON / base64-скриншоты; для чата обычно хватает дефолта.

```typescript
maxPayload: 256 * 1024, // 256KiB，收紧一点
```

## Онлайн-метрики

Чтобы сразу видеть смену числа онлайна или исход входящих, повесьте `onMetric`: колбэк на событие. Ошибка внутри колбэка только warn, на приём/отправку не влияет.

```typescript
export const ws = new WebsocketApp({
  logger: services.logger,
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

Можно периодически снимать локальный снимок (онлайн, число комнат). Это данные **одной машины**, не агрегация кластера:

```typescript
setInterval(async () => {
  const s = await ws.stats();
  console.log(s.online, s.rooms);
}, 10_000);
```

## Пуш из HTTP-маршрута

Самый частый прод-сценарий: API записало в БД → пуш тем, кто онлайн → обычный HTTP-ответ.

Сразу после соединения фреймворк сам кладёт клиента только в комнату `client.id` («только этому соединению»). Бизнес-комнаты (лобби, id заказа) нужно `join` в Channel, иначе `room('lobby').send` никто не получит.

```typescript
// src/routers/order.ts
import { Router } from '@aomex/web';
import { ws } from '../ws.js';

export const router = new Router();

router.post('/orders', { // [!code focus:8]
  action: async (ctx) => {
    const order = await createOrder(/* ... */);
    await ws.room(`order:${order.id}`).send('order.updated', order); // [!code highlight]
    ctx.send(order);
  },
});
```

Варианты пуша:

```typescript
// 所有在线连接
await ws.all.send('system.notice', { text: '维护 5 分钟' });

// 某个 client.id（点对点）
await ws.room(clientId).send('dm', { text: 'hi' });

// 全员，但排除某个人
await ws.all.send('notice', { text: '...' }, { except: clientId });
```

`except` принимает объект соединения (есть `id`) или строку id. Имя комнаты не может быть пустой строкой и не может содержать `\0` — иначе сразу ошибка.

::: tip
Memory Hub по умолчанию **не выходит за процесс**. Если в Console сделать `import { ws }` и `send`, а Console и Web — разные Node-процессы, браузер ничего не получит. На обеих сторонах один и тот же Redis Hub: [мультимашинный Hub](/ru/websocket/hub).
:::

## Сводка рядом с Web и Console

Три уже знакомые оси рядом, чтобы не путать:

| | Web | WebSocket | Console |
| --- | --- | --- | --- |
| Как матчится | метод + путь | имя события | имя команды |
| Как валидировать вход | query / body / params | `payload()` | `options()` |
| Как объявить выход | `response()` | `emit()` | — |
| Как живёт процесс | listen держит процесс | attach к тому же Server | `run` и выход |

Запросы к БД и почта — в [services](/ru/core/service); realtime вход/выход — в Channel; «после успешной записи в БД ещё раз пушнуть» — из маршрута или Console через `ws.room`.

## Дальше

- [Маршрутизация событий Channel](/ru/websocket/channel) — сначала событие, которое отвечает `pong`
- [Входящий payload](/ru/websocket/payload) / [Исходящий emit](/ru/websocket/emit)
- [Транспорт](/ru/websocket/transport) — нужен ли Socket.IO
- [Мультимашинный Hub](/ru/websocket/hub) — несколько реплик или пуш из Console через процессы
