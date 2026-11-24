---
outline: deep
---

# Транспорт

Транспорт отвечает только на одно: **каким протоколом подключается клиент и как выглядит рамка**. Комнаты и межмашинный broadcast — зона [Hub](/ru/websocket/hub). Когда бизнес Channel уже написан, смена транспорта обычно сводится к строке `new WebsocketApp({ transport })`.

Сейчас есть две готовые реализации; для старта берите стандартный WebSocket.

| Вам важнее… | Выберите |
| --- | --- |
| Нативный браузерный `WebSocket`, шлюз только пробрасывает upgrade, протокол проще | `@aomex/websocket-ws-transport` |
| Фронт уже на Socket.IO, или нужны его авто-reconnect / long-polling fallback | `@aomex/websocket-socket-io-transport` |

## Стандартный WebSocket (сначала доведите до рабочего)

```bash
pnpm add @aomex/websocket-ws-transport
```

`path`, размер одной рамки и `verify` настраиваются на `WebsocketApp` — **не** дублируйте их в `WsTransport`. Аргументы конструктора в основном пробрасываются в низкоуровневую библиотеку `ws`; интервал heartbeat задаёте через `heartbeatInterval` (по умолчанию 30 с; `0` — без heartbeat, удобно в unit-тестах):

```typescript
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';

const ws = new WebsocketApp({
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  path: '/ws',
  transport: new WsTransport({ // [!code focus:4]
    perMessageDeflate: false,
    heartbeatInterval: 30_000,
  }),
  mount: [channels('./src/channels')],
});
```

В браузере — нативный `WebSocket`, рамка JSON:

```typescript
const socket = new WebSocket('ws://localhost:3000/ws');

socket.onmessage = (ev) => {
  const frame = JSON.parse(String(ev.data));
  // frame.event / frame.data
  console.log(frame.event, frame.data);
};

socket.send(JSON.stringify({ event: 'ping', data: {} }));
```

## Переход на Socket.IO

Меняйте, когда фронт уже зависит от `socket.io-client` или нужна его деградация на плохой сети. **Комнаты по-прежнему идут через Hub aomex** — не вешайте `@socket.io/redis-adapter`, иначе получите два набора broadcast и боль при разборе.

```bash
pnpm add @aomex/websocket-socket-io-transport
```

Снова: `path` и максимальный буфер инжектит приложение. Фреймворк намеренно не светит namespace, ack и `volatile` — исходящее едино через `send` Channel / `ws.room`, без двух ментальных моделей. CORS или интервал ping задайте в конструкторе:

```typescript
import { SocketIoTransport } from '@aomex/websocket-socket-io-transport';

transport: new SocketIoTransport({ // [!code focus:3]
  cors: { origin: '*' },
  pingInterval: 25_000,
}),
```

В браузере нужен клиент Socket.IO (нативный `WebSocket` не подключится):

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', { path: '/ws' });
socket.emit('echo', { text: 'hi' });
socket.on('echo', (data) => {
  console.log(data);
});
```

## Что происходит при остановке

При `ws.attach(app, server)` уже регистрируется хук остановки WebApp: по сигналу рвутся соединения и завершается транспорт, но **переданный** вами `http.Server` сам по себе не закрывается (его закрывает WebApp). Обычно отдельный `process.on('SIGTERM')` ради транспорта не нужен.

## Дальше

- [Мультимашинный Hub](/ru/websocket/hub) — несколько реплик или пуш из Console
- [Точка входа](/ru/websocket/)
- [Маршрутизация событий](/ru/websocket/channel)
