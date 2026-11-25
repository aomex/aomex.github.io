---
outline: deep
---

# Транспортный слой

Транспорт отвечает на одно: **каким протоколом клиент подключается и как выглядят кадры**. Комнаты и broadcast между машинами — [Hub](/ru/websocket/hub). После готовых Channel смена транспорта обычно одна строка в `new WebsocketApp({ transport })`.

Два готовых варианта; для старта хватит стандартного WebSocket.

| Если важнее… | Выбор |
| --- | --- |
| Нативный `WebSocket` в браузере, прокси только upgrade, минимум протокола | `@aomex/websocket-ws-transport` |
| Уже Socket.IO на фронте, авто-reconnect / long-polling fallback | `@aomex/websocket-socket-io-transport` |

## Стандартный WebSocket (сначала завести)

```bash
pnpm add @aomex/websocket-ws-transport
```

`path`, размер кадра, `verify` — на `WebsocketApp`, **не дублируй** в `WsTransport`. Параметры конструктора в основном пробрасываются в `ws`; heartbeat — `heartbeatInterval` (30 с по умолчанию; `0` — выкл., для тестов):

```typescript
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';
import { logger } from '@/services/logger.service';

const ws = new WebsocketApp({
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  path: '/ws',
  transport: new WsTransport({ // [!code focus:4]
    perMessageDeflate: false,
    heartbeatInterval: 30_000,
  }),
  mount: [channels('./src/channels')],
});
```

В браузере нативный `WebSocket`, кадры JSON:

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

Когда фронт на `socket.io-client` или нужен fallback в плохой сети. **Комнаты — hub aomex**, не вешай `@socket.io/redis-adapter` — два broadcast'а, боль при отладке.

```bash
pnpm add @aomex/websocket-socket-io-transport
```

`path` и буферы задаёт приложение. namespace, ack, `volatile` намеренно скрыты — исходящие через Channel / `ws.room().send`. CORS и ping — в конструкторе:

```typescript
import { SocketIoTransport } from '@aomex/websocket-socket-io-transport';

transport: new SocketIoTransport({ // [!code focus:3]
  cors: { origin: '*' },
  pingInterval: 25_000,
}),
```

В браузере только клиент Socket.IO (нативный `WebSocket` не подключится):

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', { path: '/ws' });
socket.emit('echo', { text: 'hi' });
socket.on('echo', (data) => {
  console.log(data);
});
```

## При остановке

При `ws.attach(app, server)` WebApp регистрирует shutdown: по сигналу рвёт соединения, завершает транспорт, **не** закрывает переданный `http.Server` (его закроет WebApp). Обычно не нужен свой `process.on('SIGTERM')` для транспорта.

## Дальше

- [Hub](/ru/websocket/hub) — реплики и Console
- [Вход](/ru/websocket/)
- [Каналы](/ru/websocket/channel)