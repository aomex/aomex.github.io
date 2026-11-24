---
outline: deep
---

# 事件路由 Channel

Web 用「路徑」區分介面；WebSocket 用「事件名」區分訊息。你在 `src/channels` 裡按業務拆檔案，每個檔案匯出一個 `Channel`，用 `channel.on('事件名', { ... })` 註冊處理函式，最後在應用入口用 `channels('./src/channels')` 一次性掛上——和 `routers('./src/routers')` 同一套習慣。

先澄清一個容易混的詞：**Channel 不是房間**。Channel 只是把程式碼歸到一個檔案裡；「大廳 / 訂單號」那種房間，要靠後面的 `join` / `room(...).send`。一個 Channel 檔案裡完全可以處理多個事件、進出多個房間。

## 客戶端怎麼發、服務端怎麼收

標準 WebSocket（`WsTransport`）約定一幀 JSON：

```json
{ "event": "chat.send", "data": { "roomId": "lobby", "text": "hi" } }
```

`event` 必須和你在 `channel.on` 裡寫的字串一字不差；`data` 是載荷，下一篇用 `payload()` 校驗。若你選的是 Socket.IO 傳輸，瀏覽器側變成 `socket.emit('chat.send', { ... })`，事件名仍然對應 `channel.on`。

## 寫第一個能回 pong 的 Channel

從 `ping` 開始，再加「進房間」和「發聊天」——儲存後重連即可試：

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

應用入口已經掛過 `channels('./src/channels')` 的話，瀏覽器這樣試：

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

單測或不想掃目錄時，也可以直接塞例項：

```typescript
mount: [channels([chatChannel, orderChannel])],
```

::: warning
同一個事件名不能註冊兩次——同一個檔案裡不行，跨檔案也不行。載入時就會拋錯，避免兩個 handler「看起來都掛了、實際只有一個在跑」。
:::

客戶端發來的事件名若沒有任何 Channel 認領，會 `next()` 交給外層；預設是悄悄丟掉，可在入口把 `unknownEvent` 改成 `'error'`，聯調更直觀。

## action 裡的 ctx

把 ctx 想成「這一次入站訊息的工作臺」。剛連上時，框架已經幫這條連線加入了名為 `client.id` 的房間，所以外面可以用 `ws.room(某個id).send(...)` 做點對點。斷線時會自動離開全部房間，你一般不用手寫清理。

常見寫法：

| 你要做的事 | 怎麼寫 |
| --- | --- |
| 看事件名 | `ctx.event` |
| 看原始 data（還沒校驗） | `ctx.rawPayload` |
| 看校驗後的資料 | `ctx.payload`（須先掛 `payload()`） |
| 只回給當前這條連線 | `ctx.send(...)` 或 `ctx.client.send(...)` |
| 進 / 出房間 | `ctx.client.join(name)` / `leave(name)` |
| 推給某個房間 | `ctx.room(name).send(...)`（預設**含自己**） |
| 推給所有線上 | `ctx.all.send(...)` |
| 踢掉當前連線 | `ctx.client.close(code, reason)` |

房間廣播預設會推給自己。聊天場景不想收到自己剛發的那條，加上 `{ except: ctx.client }`：

```typescript
await ctx.room('lobby').send(
  'chat.message',
  { from: ctx.client.id, text: ctx.payload.text },
  { except: ctx.client }, // [!code highlight]
);
```

## 在連線上記一點業務資料

`ctx.client.data` 是一個普通物件，跟著這條連線走：登入成功後把 `userId` 塞進去，後面的事件直接讀。預設型別是 `Record<string, unknown>`，需要補全時再擴充模組：

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

## 整檔案共用的 mount

某個 Channel 裡所有事件都要先登入？寫在 `new Channel({ mount })` 上，會比每個 `on` 複製一份省事。事件自己的 `mount` 仍然可以再掛 `payload()` 等，只作用於這一條。

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

臨時關掉某個除錯事件，用 `disabled`，生產環境直接不註冊：

```typescript
channel.on('debug.dump', {
  disabled: process.env.NODE_ENV === 'production',
  action: async (ctx) => {
    await ctx.send('debug.dump', ctx.client.data);
  },
});
```

## 下一步

- [入站 payload](/zh-TW/websocket/payload) —— 別再自己 `as` 一遍 data
- [出站 emit](/zh-TW/websocket/emit) —— 給 `send` 收窄型別，順便進 AsyncAPI
- [應用入口](/zh-TW/websocket/) —— 從 HTTP 路由推房間訊息
