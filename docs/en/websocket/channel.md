---
outline: deep
---

# Event channels

Web splits APIs by path; WebSocket splits messages by event name. Under `src/channels` you split files by domain, each exporting a `Channel`, register handlers with `channel.on('event-name', { ... })`, and hang them once with `channels('./src/channels')` at the app entry—same habit as `routers('./src/routers')`.

One word that often confuses people: **a Channel is not a room**. A Channel only groups code in a file; lobby / order-id rooms come from later `join` / `room(...).send`. One Channel file can handle many events and enter many rooms.

## What the client sends, what the server receives

Standard WebSocket (`WsTransport`) uses one JSON frame:

```json
{ "event": "chat.send", "data": { "roomId": "lobby", "text": "hi" } }
```

`event` must match the string in `channel.on` exactly; `data` is the payload, validated next with `payload()`. With Socket.IO transport the browser side becomes `socket.emit('chat.send', { ... })`, still mapped to the same `channel.on`.

## First Channel that can reply pong

Start with `ping`, then “join room” and “send chat”—save, reconnect, try:

```typescript
// src/channels/chat.channel.ts
import { Channel, payload } from '@aomex/websocket';
import { rule } from '@aomex/common';

export const channel = new Channel();

channel.on('ping', {
  action: async (ctx) => {
    await ctx.send('pong', { at: Date.now() });
  },
});

channel.on('room.join', { // [!code focus:7]
  mount: [payload({ roomId: rule.string() })],
  action: async (ctx) => {
    await ctx.client.join(ctx.payload.roomId);
    await ctx.room(ctx.payload.roomId).send('room.joined', { id: ctx.client.id });
  },
});

channel.on('chat.send', {
  mount: [
    payload({
      roomId: rule.string(),
      text: rule.string().max(2000),
    }),
  ],
  action: async (ctx) => {
    await ctx.room(ctx.payload.roomId).send(
      'chat.message',
      { from: ctx.client.id, text: ctx.payload.text },
      { except: ctx.client },
    );
  },
});
```

If the app entry already mounts `channels('./src/channels')`, try from the browser:

```typescript
const socket = new WebSocket('ws://localhost:3000/ws');
socket.onopen = () => {
  socket.send(JSON.stringify({ event: 'ping', data: {} }));
  socket.send(
    JSON.stringify({ event: 'room.join', data: { roomId: 'lobby' } }),
  );
};
socket.onmessage = (ev) => {
  console.log(JSON.parse(String(ev.data)));
};
```

In tests, or when you do not want directory scanning, pass instances directly:

```typescript
mount: [channels([chatChannel, orderChannel])],
```

::: warning
The same event name cannot be registered twice—not in one file, not across files. Load throws so you never get two handlers that “look mounted” while only one runs.
:::

Unclaimed client event names `next()` to the outer layer; default is silent drop. Set `unknownEvent` to `'error'` at the entry for clearer integration.

## ctx inside action

Treat ctx as the workbench for **this** inbound message. On connect the framework already joined a room named `client.id`, so outsiders can `ws.room(someId).send(...)` for point-to-point. On disconnect the client leaves every room automatically—you usually skip manual cleanup.

Common moves:

| You want to… | Write |
| --- | --- |
| Read the event name | `ctx.event` |
| Read raw data (not validated yet) | `ctx.rawPayload` |
| Read validated data | `ctx.payload` (must mount `payload()` first) |
| Reply only to this connection | `ctx.send(...)` or `ctx.client.send(...)` |
| Join / leave a room | `ctx.client.join(name)` / `leave(name)` |
| Push to a room | `ctx.room(name).send(...)` (default **includes self**) |
| Push to everyone online | `ctx.all.send(...)` |
| Kick this connection | `ctx.client.close(code, reason)` |

Room broadcasts include yourself by default. In chat, skip your own just-sent message with `{ except: ctx.client }`:

```typescript
await ctx.room('lobby').send(
  'chat.message',
  { from: ctx.client.id, text: ctx.payload.text },
  { except: ctx.client }, // [!code highlight]
);
```

## Stash a little business data on the connection

`ctx.client.data` is a plain object that follows this connection: after login stash `userId`, later events read it. Default type is `Record<string, unknown>`; enrich the module when you need more:

```typescript
channel.on('auth.ok', {
  mount: [payload({ userId: rule.string() })],
  action: async (ctx) => {
    ctx.client.data['userId'] = ctx.payload.userId; // [!code highlight]
    await ctx.send('auth.ok', { ok: true });
  },
});
```

```typescript
declare module '@aomex/websocket' {
  namespace WebsocketContext {
    interface Props {
      userId: string;
    }
  }
}
```

## Shared mount for the whole file

Every event in a Channel must log in first? Put it on `new Channel({ mount })` instead of copying on every `on`. Per-event `mount` can still add `payload()` and only applies to that handler.

```typescript
export const channel = new Channel({
  mount: [requireLogin()], // [!code highlight]
});

channel.on('chat.send', {
  mount: [payload({ text: rule.string().max(2000) })],
  action: async (ctx) => {
    await ctx.room('lobby').send('chat.message', {
      from: ctx.client.id,
      text: ctx.payload.text,
    });
  },
});
```

Temporarily disable a debug event with `disabled`; production simply never registers it:

```typescript
channel.on('debug.dump', {
  disabled: process.env.NODE_ENV === 'production',
  action: async (ctx) => {
    await ctx.send('debug.dump', ctx.client.data);
  },
});
```

## Next

- [Inbound payload](/en/websocket/payload) — stop `as`-casting data yourself
- [Outbound emit](/en/websocket/emit) — narrow `send` types and feed AsyncAPI
- [App entry](/en/websocket/) — push room messages from HTTP routes
