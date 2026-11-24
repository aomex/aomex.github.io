---
outline: deep
---

# 传输层

传输层只回答一件事：**客户端用什么协议连上来、帧长什么样**。房间、跨机器广播不归它管，那是 [Hub](/zh/websocket/hub) 的事。业务 Channel 写好之后，换传输通常只改 `new WebsocketApp({ transport })` 那一行。

现在有两条现成实现，入门先用标准 WebSocket 即可。

| 你更在意… | 选 |
| --- | --- |
| 浏览器原生 `WebSocket`、网关只转发 upgrade、协议越简单越好 | `@aomex/websocket-ws-transport` |
| 前端已经是 Socket.IO，或需要它的自动重连 / 长轮询降级 | `@aomex/websocket-socket-io-transport` |

## 标准 WebSocket（推荐先跑通）

```bash
pnpm add @aomex/websocket-ws-transport
```

`path`、单帧大小、`verify` 都在 `WebsocketApp` 上配，**不要**在 `WsTransport` 里再写一遍。构造参数主要是透传给底层 `ws` 库的选项；需要调心跳时再写 `heartbeatInterval`（默认 30 秒；写成 `0` 就关心跳，单测常用）：

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

浏览器侧用原生 `WebSocket`，帧是 JSON：

```typescript
const socket = new WebSocket('ws://localhost:3000/ws');

socket.onmessage = (ev) => {
  const frame = JSON.parse(String(ev.data));
  // frame.event / frame.data
  console.log(frame.event, frame.data);
};

socket.send(JSON.stringify({ event: 'ping', data: {} }));
```

## 换成 Socket.IO

当前端已经依赖 `socket.io-client`，或你需要它在恶劣网络下的降级时再换。**房间仍然走 aomex 的 Hub**，不要再挂 `@socket.io/redis-adapter`，否则会出现两套广播，排障很痛苦。

```bash
pnpm add @aomex/websocket-socket-io-transport
```

同样：`path`、最大缓冲由应用注入。框架刻意不暴露 namespace、ack、`volatile`——出站统一用 Channel / `ws.room` 的 `send`，避免两套心智。需要 CORS 或改 ping 间隔时，在构造参数里写：

```typescript
import { SocketIoTransport } from '@aomex/websocket-socket-io-transport';

transport: new SocketIoTransport({ // [!code focus:3]
  cors: { origin: '*' },
  pingInterval: 25_000,
}),
```

浏览器侧必须用 Socket.IO 客户端（原生 `WebSocket` 连不上）：

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', { path: '/ws' });
socket.emit('echo', { text: 'hi' });
socket.on('echo', (data) => {
  console.log(data);
});
```

## 关停时会发生什么

`ws.attach(app, server)` 时已经向 WebApp 登记了关停钩子：收到信号后会踢掉连接、收尾传输，但**不会**把你传入的 `http.Server` 连带关掉（Server 由 WebApp 自己关）。你一般不用为传输层再写一遍 `process.on('SIGTERM')`。

## 下一步

- [多机 Hub](/zh/websocket/hub) —— 多副本或 Console 也要推
- [应用入口](/zh/websocket/)
- [事件路由](/zh/websocket/channel)
