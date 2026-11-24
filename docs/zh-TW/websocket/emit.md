---
outline: deep
---

# 出站 emit

HTTP 裡用 `response()` 宣告「這個介面會返回什麼樣」；WebSocket 裡對應的是 `emit()`：宣告**這個事件處理過程中，你允許 `send` 出去的事件名和載荷長什麼樣**。

執行時它幾乎什麼都不做（不會攔你亂傳的物件），真正的好處有兩個：

1. TypeScript 會收窄 `ctx.send` / `ctx.room().send` / `ctx.all.send`——拼錯事件名、少傳欄位，編輯器直接紅。
2. 生成 [AsyncAPI](/zh-TW/asyncapi/) 時，出站 message 從這裡來。

在聊天入站旁邊掛上出站契約：房間訊息一條、傳送確認一條。不需要載荷時省略 `data`；`description` 只進文件，不影響執行。

```typescript
import { Channel, emit, payload } from '@aomex/websocket';
import { rule } from '@aomex/common';

export const channel = new Channel();

channel.on('chat.send', { // [!code focus:24]
  mount: [
    payload({
      roomId: rule.string(),
      text: rule.string().max(2000),
    }),
    emit({ // [!code highlight]
      event: 'chat.message',
      description: '房间内聊天消息',
      data: {
        from: rule.string(),
        text: rule.string(),
      },
    }),
    emit({ event: 'chat.ack', description: '发送确认' }),
  ],
  action: async (ctx) => {
    await ctx.room(ctx.payload.roomId).send(
      'chat.message',
      { from: ctx.client.id, text: ctx.payload.text },
      { except: ctx.client },
    );
    await ctx.send('chat.ack');
  },
});
```

可以掛很多個 `emit()`，契約會合併成一張表。

::: warning
`emit()` **不會**在執行時檢查你傳給 `send` 的物件對不對。型別靠 TS；文件靠生成器讀鉤子。漏掛 `emit` 時，`send` 又變回「隨便傳事件名」，AsyncAPI 裡也看不到這條出站訊息。
:::

路由裡 `await ws.room(...).send('order.updated', order)` **不會**自動套上某個 Channel 裡的 `emit` 型別——那是另一條呼叫面。想讓推送體和文件一致，按同一份 schema（或手寫同形狀的物件）組裝即可。

## 下一步

- [入站 payload](/zh-TW/websocket/payload)
- [生成 AsyncAPI](/zh-TW/asyncapi/) —— 把 payload / emit 掃成文件
- [事件路由](/zh-TW/websocket/channel)
