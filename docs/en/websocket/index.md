---
outline: deep
---

# WebSocket app entry

Chat, order status, collaborative cursors—anything where the server must push to the browser—belongs here. You create a `WebsocketApp` much like a Web app, then attach it to the **same** HTTP port. Clients connect and talk by event name; after an HTTP handler finishes writing to the database, you can call the same `ws` export and push to whoever is still online.

One ground rule up front: delivery is **best-effort**. When `await ws.room(...).send(...)` finishes, the framework has handed the message out (or to Redis)—it does **not** guarantee the peer received it, and there is no automatic retry or offline mailbox. Persist anything important; after reconnect, clients catch up over HTTP.

## Install and write the first instance

Assume you already have a working [Web app](/en/web/). Add the realtime packages:

```bash
pnpm add @aomex/websocket @aomex/websocket-ws-transport
```

Keep `WebsocketApp` in its own file and `export` it. The HTTP entry, routes, and Console commands should all import **that** instance—do not `new` it in every file or pushes will miss the connections.

```typescript
// src/ws.ts
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';
import { logger } from '@/services/logger.service';

export const ws = new WebsocketApp({ // [!code focus:8]
  logger, // [!code highlight]
  language: { mode: 'fixed', language: 'en-US' },
  path: '/ws',
  transport: new WsTransport(),
  mount: [channels('./src/channels')], // [!code highlight]
});
```

`logger`, `language`, and `transport` are required—TypeScript will stop you if any are missing.

- `logger`: pass the **same** `Logger` instance as Web / Console. Transport init failures and room fan-out errors land here.
- `language`: framework copy on this connection (handshake failure, illegal-frame close reason, rate-limit / validation pushbacks). The snippet uses `fixed`—simplest for backends, intranet, and single-locale apps.
- `mount`: start with `channels('./src/channels')`, the same idea as `routers('./src/routers')` on Web. How to write Channels: [Event channels](/en/websocket/channel).

When public multi-locale clients need negotiation from handshake headers, switch to `dynamic` and give a `fallback`:

```typescript
language: {
  mode: 'dynamic', // [!code highlight]
  header: 'accept-language',
  fallback: 'en-US',
},
```

`header` defaults to `accept-language` (sorted by `q`); a custom App header can be `x-language`. Language codes look like `zh-CN`, `en-US` (hyphenated).

::: tip
When you call `ws.room().send()` from an **HTTP route**, the language follows **that HTTP request**, not the language the long-lived socket negotiated at handshake.
:::

## Attach to the HTTP port

WebSocket does not open a second listen port—it upgrades the same `http.Server`. So the process entry should not call `app.listen(3000)` alone. Instead: `app.http({})` → `ws.attach` → `listen`.

```typescript
// src/web.ts — real process entry
import { routers, WebApp } from '@aomex/web';
import { services } from '@/services';
import { ws } from '@/ws';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'en-US' },
  proxyIP: { mode: 'detect' },
  mount: [routers('./src/routers')],
});

const server = app.http({}); // [!code focus:3]
ws.attach(app, server); // [!code highlight]
server.listen(3000, () => {
  console.log('HTTP + WebSocket started');
});
```

`attach` must run **before** `listen`; the same `ws` can attach only once—calling again throws. On shutdown signals the framework drains HTTP and WebSocket together; you do not write two cleanup paths.

::: warning
Do not call `ws.attach(...)` at the top level of `src/ws.ts`. Console commands also import `ws`; a bare import would attach again in another process and scramble pushes.
:::

Start:

```bash
node --import tsx/esm --watch src/web.ts
```

Smoke-test connectivity from the browser console (default path `/ws`):

```typescript
const socket = new WebSocket('ws://localhost:3000/ws');
socket.onopen = () => {
  socket.send(JSON.stringify({ event: 'ping', data: {} }));
};
socket.onmessage = (ev) => {
  console.log(ev.data);
};
```

Without a matching Channel, the message may be silently dropped (default `unknownEvent: 'ignore'`). Get the channel working first, then flesh out handlers.

## Where clients connect, which protocol

`path` decides the browser URL. Default `/ws`; if you change it, change the client too:

```typescript
path: '/realtime',
// browser: new WebSocket('ws://localhost:3000/realtime')
```

A Socket.IO client looks like `io('http://localhost:3000', { path: '/realtime' })`.

`transport` is **required**—it owns the upgrade handshake and every frame. Local onboarding is fine with `new WsTransport()`; later switching to Socket.IO is usually one line, Channels stay put—see [Transport](/en/websocket/transport).

`hub` is **optional**. The default in-memory Hub keeps rooms and broadcasts in **this process** only—enough for single-node development. Multi-replica, or a Console process that must push to browsers on Web workers, needs a Redis Hub—see [Multi-node Hub](/en/websocket/hub).

The two choices are independent: change transport without changing Hub; scale out by changing Hub only. With Socket.IO, do **not** also mount Socket.IO’s Redis adapter—rooms only honour aomex’s Hub.

## Gate the handshake, then global middleware

Right before upgrade, `verify` is a coarse gate: the argument is a normal Web request object (Cookie, headers, IP). Return `true` to allow; `false` or an HTTP status (e.g. `401`) to reject. Per-event auth belongs on Channel mount.

```typescript
import { logger } from '@/services/logger.service';

export const ws = new WebsocketApp({
  logger,
  language: { mode: 'fixed', language: 'en-US' },
  transport: new WsTransport(),
  verify: (request) => { // [!code focus:3]
    return request.cookies['sid'] ? true : 401;
  },
  mount: [channels('./src/channels')],
});
```

`mount` is an onion queue like `WebApp.mount`. Put `channels(...)` **last**; ahead of it hang access log, rate limit, abuse checks. Only `middleware.socket` / `middleware.mixin`—do not drop HTTP-only middleware here.

```typescript
mount: [
  // access log, rate limit… see sidebar “Common middleware”
  channels('./src/channels'),
],
```

## Integration: unknown events and frame size

When the client sends an unregistered event name, default `unknownEvent: 'ignore'` drops it silently. During integration set `'error'` so the framework pushes `{ event: 'error', … }` and the frontend spots typos immediately; most production setups stay on `ignore`.

```typescript
unknownEvent: 'error', // turn on while integrating
```

`maxPayload` is the max bytes per frame, default 1MiB. Oversized frames cost memory and the transport disconnects. Raise it for large JSON / screenshot base64; chat text usually keeps the default.

```typescript
maxPayload: 256 * 1024, // 256KiB, tighten a bit
```

## Watch online state

For immediate feedback on population changes or inbound success/failure, hang `onMetric`: it fires when something happens. Errors thrown in the callback only warn—they do not break send/receive.

```typescript
import { logger } from '@/services/logger.service';

export const ws = new WebsocketApp({
  logger,
  language: { mode: 'fixed', language: 'en-US' },
  transport: new WsTransport(),
  mount: [channels('./src/channels')],
  onMetric: (e) => { // [!code focus:5]
    if (e.type === 'online') {
      console.log('online now', e.online);
    }
  },
});
```

You can also poll a local snapshot (online count, room count). This is **per-process** data, not a cluster aggregate:

```typescript
setInterval(async () => {
  const s = await ws.stats();
  console.log(s.online, s.rooms);
}, 10_000);
```

## Push from an HTTP route

The most common production pattern: write the DB in the HTTP handler → push to whoever is still online → return as usual.

On connect the framework only auto-joins a room named `client.id` (“push to this connection only”). Business rooms (lobby, order id) need an explicit `join` in a Channel, or `room('lobby').send` has no listeners.

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

Push styles:

```typescript
// every online connection
await ws.all.send('system.notice', { text: 'Maintenance in 5 minutes' });

// a client.id (point-to-point)
await ws.room(clientId).send('dm', { text: 'hi' });

// everyone except one person
await ws.all.send('notice', { text: '...' }, { except: clientId });
```

`except` accepts a connection object (anything with `id`) or an id string. Room names cannot be empty or contain `\0`, or the call throws immediately.

::: tip
The default memory Hub **does not cross processes**. `import { ws }` then `send` from Console reaches no browser if Console and Web are different Node processes—put both on the same Redis Hub, see [Multi-node Hub](/en/websocket/hub).
:::

## Side by side with Web and Console

Three things you already know, lined up so they do not blur:

| | Web | WebSocket | Console |
| --- | --- | --- | --- |
| How matching works | method + path | event name | command name |
| How input is validated | query / body / params | `payload()` | `options()` |
| How output is declared | `response()` | `emit()` | — |
| How the process stays alive | listen keeps running | attach to the same Server | exits after `run` |

Keep DB / mail in [services](/en/core/service); realtime in/out in Channels; “write DB then push once” in routes or Console commands that call `ws.room`.

## Next

- [Event channels](/en/websocket/channel) — first event that can reply `pong`
- [Inbound payload](/en/websocket/payload) / [Outbound emit](/en/websocket/emit)
- [Transport](/en/websocket/transport) — whether to take Socket.IO
- [Multi-node Hub](/en/websocket/hub) — multi-replica or Console cross-process push
