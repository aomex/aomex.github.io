---
outline: deep
---

# 傳輸層

傳輸層只回答一件事：**客戶端用什麼協議連上來、幀長什麼樣**。房間、跨機器廣播不歸它管，那是 [Hub](/zh-TW/websocket/hub) 的事。業務 Channel 寫好之後，換傳輸通常只改 `new WebsocketApp({ transport })` 那一行。

現在有兩條現成實現，入門先用標準 WebSocket 即可。

| 你更在意… | 選 |
| --- | --- |
| 瀏覽器原生 `WebSocket`、閘道器只轉發 upgrade、協議越簡單越好 | `@aomex/websocket-ws-transport` |
| 前端已經是 Socket.IO，或需要它的自動重連 / 長輪詢降級 | `@aomex/websocket-socket-io-transport` |

## 標準 WebSocket（推薦先跑通）

```bash
pnpm add @aomex/websocket-ws-transport
```

`path`、單幀大小、`verify` 都在 `WebsocketApp` 上配，**不要**在 `WsTransport` 裡再寫一遍。構造引數主要是透傳給底層 `ws` 庫的選項；需要調心跳時再寫 `heartbeatInterval`（預設 30 秒；寫成 `0` 就關心跳，單測常用）：

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

瀏覽器側用原生 `WebSocket`，幀是 JSON：

```typescript
const socket = new WebSocket('ws://localhost:3000/ws');

socket.onmessage = (ev) => {
  const frame = JSON.parse(String(ev.data));
  // frame.event / frame.data
  console.log(frame.event, frame.data);
};

socket.send(JSON.stringify({ event: 'ping', data: {} }));
```

## 換成 Socket.IO

當前端已經依賴 `socket.io-client`，或你需要它在惡劣網路下的降級時再換。**房間仍然走 aomex 的 Hub**，不要再掛 `@socket.io/redis-adapter`，否則會出現兩套廣播，排障很痛苦。

```bash
pnpm add @aomex/websocket-socket-io-transport
```

同樣：`path`、最大緩衝由應用注入。框架刻意不暴露 namespace、ack、`volatile`——出站統一用 Channel / `ws.room` 的 `send`，避免兩套心智。需要 CORS 或改 ping 間隔時，在構造引數裡寫：

```typescript
import { SocketIoTransport } from '@aomex/websocket-socket-io-transport';

transport: new SocketIoTransport({ // [!code focus:3]
  cors: { origin: '*' },
  pingInterval: 25_000,
}),
```

瀏覽器側必須用 Socket.IO 客戶端（原生 `WebSocket` 連不上）：

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', { path: '/ws' });
socket.emit('echo', { text: 'hi' });
socket.on('echo', (data) => {
  console.log(data);
});
```

## 關停時會發生什麼

`ws.attach(app, server)` 時已經向 WebApp 登記了關停鉤子：收到訊號後會踢掉連線、收尾傳輸，但**不會**把你傳入的 `http.Server` 連帶關掉（Server 由 WebApp 自己關）。你一般不用為傳輸層再寫一遍 `process.on('SIGTERM')`。

## 下一步

- [多機 Hub](/zh-TW/websocket/hub) —— 多副本或 Console 也要推
- [應用入口](/zh-TW/websocket/)
- [事件路由](/zh-TW/websocket/channel)
