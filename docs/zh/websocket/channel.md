---
outline: deep
---

# 事件路由 Channel

Web 用「路径」区分接口；WebSocket 用「事件名」区分消息。你在 `src/channels` 里按业务拆文件，每个文件导出一个 `Channel`，用 `channel.on('事件名', { ... })` 注册处理函数，最后在应用入口用 `channels('./src/channels')` 一次性挂上——和 `routers('./src/routers')` 同一套习惯。

先澄清一个容易混的词：**Channel 不是房间**。Channel 只是把代码归到一个文件里；「大厅 / 订单号」那种房间，要靠后面的 `join` / `room(...).send`。一个 Channel 文件里完全可以处理多个事件、进出多个房间。

## 客户端怎么发、服务端怎么收

标准 WebSocket（`WsTransport`）约定一帧 JSON：

```json
{ "event": "chat.send", "data": { "roomId": "lobby", "text": "hi" } }
```

`event` 必须和你在 `channel.on` 里写的字符串一字不差；`data` 是载荷，下一篇用 `payload()` 校验。若你选的是 Socket.IO 传输，浏览器侧变成 `socket.emit('chat.send', { ... })`，事件名仍然对应 `channel.on`。

## 写第一个能回 pong 的 Channel

从 `ping` 开始，再加「进房间」和「发聊天」——保存后重连即可试：

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

应用入口已经挂过 `channels('./src/channels')` 的话，浏览器这样试：

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

单测或不想扫目录时，也可以直接塞实例：

```typescript
mount: [channels([chatChannel, orderChannel])],
```

::: warning
同一个事件名不能注册两次——同一个文件里不行，跨文件也不行。加载时就会抛错，避免两个 handler「看起来都挂了、实际只有一个在跑」。
:::

客户端发来的事件名若没有任何 Channel 认领，会 `next()` 交给外层；默认是悄悄丢掉，可在入口把 `unknownEvent` 改成 `'error'`，联调更直观。

## action 里的 ctx

把 ctx 想成「这一次入站消息的工作台」。刚连上时，框架已经帮这条连接加入了名为 `client.id` 的房间，所以外面可以用 `ws.room(某个id).send(...)` 做点对点。断线时会自动离开全部房间，你一般不用手写清理。

常见写法：

| 你要做的事 | 怎么写 |
| --- | --- |
| 看事件名 | `ctx.event` |
| 看原始 data（还没校验） | `ctx.rawPayload` |
| 看校验后的数据 | `ctx.payload`（须先挂 `payload()`） |
| 只回给当前这条连接 | `ctx.send(...)` 或 `ctx.client.send(...)` |
| 进 / 出房间 | `ctx.client.join(name)` / `leave(name)` |
| 推给某个房间 | `ctx.room(name).send(...)`（默认**含自己**） |
| 推给所有在线 | `ctx.all.send(...)` |
| 踢掉当前连接 | `ctx.client.close(code, reason)` |

房间广播默认会推给自己。聊天场景不想收到自己刚发的那条，加上 `{ except: ctx.client }`：

```typescript
await ctx.room('lobby').send(
  'chat.message',
  { from: ctx.client.id, text: ctx.payload.text },
  { except: ctx.client }, // [!code highlight]
);
```

## 在连接上记一点业务数据

`ctx.client.data` 是一个普通对象，跟着这条连接走：登录成功后把 `userId` 塞进去，后面的事件直接读。默认类型是 `Record<string, unknown>`，需要补全时再扩充模块：

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

## 整文件共用的 mount

某个 Channel 里所有事件都要先登录？写在 `new Channel({ mount })` 上，会比每个 `on` 复制一份省事。事件自己的 `mount` 仍然可以再挂 `payload()` 等，只作用于这一条。

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

临时关掉某个调试事件，用 `disabled`，生产环境直接不注册：

```typescript
channel.on('debug.dump', {
  disabled: process.env.NODE_ENV === 'production',
  action: async (ctx) => {
    await ctx.send('debug.dump', ctx.client.data);
  },
});
```

## 下一步

- [入站 payload](/zh/websocket/payload) —— 别再自己 `as` 一遍 data
- [出站 emit](/zh/websocket/emit) —— 给 `send` 收窄类型，顺便进 AsyncAPI
- [应用入口](/zh/websocket/) —— 从 HTTP 路由推房间消息
