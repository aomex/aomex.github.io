---
outline: deep
---

# Transport

Transport answers one question only: **which protocol clients use to connect, and what frames look like**. Rooms and cross-machine broadcast are [Hub](/en/websocket/hub)’s job. Once Channels are written, switching transport is usually changing the `new WebsocketApp({ transport })` line.

Two ready implementations exist; start with standard WebSocket.

| You care more about… | Pick |
| --- | --- |
| Native browser `WebSocket`, gateway only forwards upgrade, simplest protocol | `@aomex/websocket-ws-transport` |
| Frontend already on Socket.IO, or you need its auto-reconnect / long-polling fallback | `@aomex/websocket-socket-io-transport` |

## Standard WebSocket (get this running first)

```bash
pnpm add @aomex/websocket-ws-transport
```

`path`, frame size, and `verify` live on `WebsocketApp`—**do not** repeat them on `WsTransport`. Constructor args mostly forward to the underlying `ws` library; set `heartbeatInterval` when you need heartbeats (default 30s; `0` disables them—common in unit tests):

```typescript
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';
import { logger } from '@/services/logger.service';

const ws = new WebsocketApp({
  logger,
  language: { mode: 'fixed', language: 'en-US' },
  path: '/ws',
  transport: new WsTransport({ // [!code focus:4]
    perMessageDeflate: false,
    heartbeatInterval: 30_000,
  }),
  mount: [channels('./src/channels')],
});
```

On the browser use native `WebSocket`; frames are JSON:

```typescript
const socket = new WebSocket('ws://localhost:3000/ws');

socket.onmessage = (ev) => {
  const frame = JSON.parse(String(ev.data));
  // frame.event / frame.data
  console.log(frame.event, frame.data);
};

socket.send(JSON.stringify({ event: 'ping', data: {} }));
```

## Switch to Socket.IO

Switch when the frontend already depends on `socket.io-client`, or you need its degradation on bad networks. **Rooms still go through aomex’s Hub**—do not also mount `@socket.io/redis-adapter`, or you get two broadcast systems and painful debugging.

```bash
pnpm add @aomex/websocket-socket-io-transport
```

Same rule: `path` and max buffer come from the app. The framework deliberately does not expose namespace, ack, or `volatile`—outbound stays on Channel / `ws.room` `send` so you keep one mental model. For CORS or ping interval, pass constructor options:

```typescript
import { SocketIoTransport } from '@aomex/websocket-socket-io-transport';

transport: new SocketIoTransport({ // [!code focus:3]
  cors: { origin: '*' },
  pingInterval: 25_000,
}),
```

Browsers must use the Socket.IO client (native `WebSocket` will not connect):

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', { path: '/ws' });
socket.emit('echo', { text: 'hi' });
socket.on('echo', (data) => {
  console.log(data);
});
```

## What happens on shutdown

`ws.attach(app, server)` already registers shutdown hooks with WebApp: on signal it kicks connections and finishes the transport, but it does **not** close the `http.Server` you passed (WebApp closes that). You usually do not write another `process.on('SIGTERM')` for the transport.

## Next

- [Multi-node Hub](/en/websocket/hub) — multi-replica or Console must push too
- [App entry](/en/websocket/)
- [Event channels](/en/websocket/channel)
