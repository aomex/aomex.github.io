---
outline: deep
---

# Multi-node Hub

The Hub remembers “who is in which room” and “how to fan out a broadcast.” The default memory Hub only knows connections in **this Node process**—plenty for local development.

When must you switch to a Redis Hub?

- Production runs multiple Web replicas; users may land on different machines
- Console (or another process) must `ws.room(...).send` to browsers still connected on Web workers

Transport (ws / Socket.IO) and Hub **each own their job**: change the client protocol without changing Hub; scale out by changing Hub only.

Delivery is still best-effort: a successful Redis `PUBLISH` does not mean every machine finished fan-out, let alone that the browser already rendered.

## Default is fine: MemoryHub

Omit `hub` and you get the in-memory implementation. Keep it for single-node and local integration—the entry page’s `new WebsocketApp({ ... })` already runs this way.

Remember the limit: `room().send` in process A **does not** reach connections in process B. If Web and Console are two processes, Console sends never reach the browser.

## Multi-node: RedisHub

```bash
pnpm add @aomex/websocket-redis-hub
```

Each machine still tracks “which connections are local and which rooms they joined”; cross-machine broadcast uses Redis Pub/Sub. When a room has no local members, the process unsubscribes from that channel to avoid empty subscriptions.

`host` / `port` / password and friends match ordinary ioredis config. When several projects share one Redis, change `channel` (Pub/Sub prefix, default `aomex:websocket:hub`) to a non-colliding name. `fanoutBatchSize` is how many local connections to fan out per batch—usually leave it alone.

```typescript
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';
import { RedisHub } from '@aomex/websocket-redis-hub';
import { logger } from '@/services/logger.service';

export const ws = new WebsocketApp({
  logger,
  language: { mode: 'fixed', language: 'en-US' },
  transport: new WsTransport(),
  hub: new RedisHub({ // [!code focus:5]
    host: '127.0.0.1',
    port: 6379,
    channel: 'aomex:websocket:hub',
    fanoutBatchSize: 512,
  }),
  mount: [channels('./src/channels')],
});
```

Actual channels are `{prefix}:a` (everyone) and `{prefix}:r:{roomName}`. **Every process that must interoperate** (each Web replica, any Console that pushes) needs the same Redis and the same `channel` prefix.

::: warning
Even with Socket.IO transport, do **not** also mount Socket.IO’s official Redis adapter. Rooms and broadcasts only honour aomex’s `hub`—stacking both is a landmine.
:::

## Console push across processes

Same pattern as the entry page: export `ws` from one file; the Web process `attach`s; Console **only imports, never attaches**. Both construct with the same `RedisHub` config:

```typescript
// inside a Console command
import { ws } from '@/ws';

await ws.room(`order:${orderId}`).send('order.updated', order);
await ws.all.send('system.notice', { text: 'Maintenance tonight at 23:00' });
```

Sends wait until the Hub is ready. Clients offline at that moment miss the message—next page load catches up over HTTP.

## Next

- [App entry](/en/websocket/) — attach and push patterns
- [Transport](/en/websocket/transport)
- [Multi-process and scale-out](/en/advanced/cluster)
