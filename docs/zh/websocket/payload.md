---
outline: deep
---

# 入站 payload

客户端随事件带来的 `data`，默认是不可信的。在事件的 mount 里挂上 `payload()`，用你已经熟悉的 [验证器](/zh/validators/) 声明字段；过关后业务里直接用 `ctx.payload`，类型也是收窄过的。不过关时框架会向**当前这条连接**推一条 `{ event: 'error', data: { message } }`，**不会**进 `action`——和 HTTP 上 body 校验失败返回 400、不进路由是同一个思路。

先写一条聊天入站：

```typescript
import { Channel, payload } from '@aomex/websocket';
import { rule } from '@aomex/common';

export const channel = new Channel();

channel.on('chat.send', { // [!code focus:16]
  mount: [
    payload({ // [!code highlight]
      roomId: rule.string(),
      text: rule.string().max(2000),
    }),
  ],
  action: async (ctx) => {
    // 这里 ctx.payload.roomId / text 已经是 string
    await ctx.room(ctx.payload.roomId).send(
      'chat.message',
      { from: ctx.client.id, text: ctx.payload.text },
      { except: ctx.client },
    );
  },
});
```

客户端仍按约定发：

```typescript
socket.send(
  JSON.stringify({
    event: 'chat.send',
    data: { roomId: 'lobby', text: 'hello' },
  }),
);
```

`text` 超长或缺 `roomId` 时，你在 `onmessage` 里会收到 `event === 'error'`，业务 action 根本不会跑。别在 action 里再手写一遍 `if (typeof raw.text !== 'string')`——和校验、错误文案、后面的 AsyncAPI 都会对不齐。

::: tip
没挂 `payload()` 时，`ctx.payload` 类型是 `unknown`，运行时也可能根本没赋值。临时调试可以读 `ctx.rawPayload`（帧里原始的 `data`），正式接口请挂上 `payload()`。
:::

## 多个事件共用一段字段

比如每个事件都可能带可选 `token`，可以挂在 Channel 构造上；单个事件再挂自己的 `payload()` 补业务字段。类型上，后挂的同名字段会盖住前面的。

```typescript
export const channel = new Channel({
  mount: [
    payload({
      token: rule.string().optional(),
    }),
  ],
});

channel.on('chat.send', { // [!code focus:12]
  mount: [
    payload({
      text: rule.string().max(2000),
    }),
  ],
  action: async (ctx) => {
    ctx.payload.token; // string | undefined
    ctx.payload.text; // string
  },
});
```

入参形态和 `body()` / `query()` 一样：字段表、`rule.object()`、标量、`schema(...)` 都可以。生成 [AsyncAPI](/zh/asyncapi/) 时，这里的声明会写进入站 message；漏挂则文档里这段是空的，运行时却仍可用 `rawPayload` 糊弄——联调时很难发现契约缺了。

::: tip
限流触发、鉴权失败等业务错误，习惯上也回推 `event: 'error'`（或你在 [emit](/zh/websocket/emit) 里声明的专用事件）。前端只监听少数几个出口，心智更简单。
:::

## 下一步

- [出站 emit](/zh/websocket/emit)
- [事件路由](/zh/websocket/channel)
- [验证器快速上手](/zh/validators/)
