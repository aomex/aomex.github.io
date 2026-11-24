---
outline: deep
---

# 出站 emit

HTTP 里用 `response()` 声明「这个接口会返回什么样」；WebSocket 里对应的是 `emit()`：声明**这个事件处理过程中，你允许 `send` 出去的事件名和载荷长什么样**。

运行时它几乎什么都不做（不会拦你乱传的对象），真正的好处有两个：

1. TypeScript 会收窄 `ctx.send` / `ctx.room().send` / `ctx.all.send`——拼错事件名、少传字段，编辑器直接红。
2. 生成 [AsyncAPI](/zh/asyncapi/) 时，出站 message 从这里来。

在聊天入站旁边挂上出站契约：房间消息一条、发送确认一条。不需要载荷时省略 `data`；`description` 只进文档，不影响运行。

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

可以挂很多个 `emit()`，契约会合并成一张表。

::: warning
`emit()` **不会**在运行时检查你传给 `send` 的对象对不对。类型靠 TS；文档靠生成器读钩子。漏挂 `emit` 时，`send` 又变回「随便传事件名」，AsyncAPI 里也看不到这条出站消息。
:::

路由里 `await ws.room(...).send('order.updated', order)` **不会**自动套上某个 Channel 里的 `emit` 类型——那是另一条调用面。想让推送体和文档一致，按同一份 schema（或手写同形状的对象）组装即可。

## 下一步

- [入站 payload](/zh/websocket/payload)
- [生成 AsyncAPI](/zh/asyncapi/) —— 把 payload / emit 扫成文档
- [事件路由](/zh/websocket/channel)
