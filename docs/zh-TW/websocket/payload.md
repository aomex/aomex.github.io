---
outline: deep
---

# 入站 payload

客戶端隨事件帶來的 `data`，預設是不可信的。在事件的 mount 裡掛上 `payload()`，用你已經熟悉的 [驗證器](/zh-TW/validators/) 宣告欄位；過關後業務裡直接用 `ctx.payload`，型別也是收窄過的。不過關時框架會向**當前這條連線**推一條 `{ event: 'error', data: { message } }`，**不會**進 `action`——和 HTTP 上 body 校驗失敗返回 400、不進路由是同一個思路。

先寫一條聊天入站：

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

客戶端仍按約定發：

```typescript
socket.send(
  JSON.stringify({
    event: 'chat.send',
    data: { roomId: 'lobby', text: 'hello' },
  }),
);
```

`text` 超長或缺 `roomId` 時，你在 `onmessage` 裡會收到 `event === 'error'`，業務 action 根本不會跑。別在 action 裡再手寫一遍 `if (typeof raw.text !== 'string')`——和校驗、錯誤文案、後面的 AsyncAPI 都會對不齊。

::: tip
沒掛 `payload()` 時，`ctx.payload` 型別是 `unknown`，執行時也可能根本沒賦值。臨時除錯可以讀 `ctx.rawPayload`（幀裡原始的 `data`），正式介面請掛上 `payload()`。
:::

## 多個事件共用一段欄位

比如每個事件都可能帶可選 `token`，可以掛在 Channel 構造上；單個事件再掛自己的 `payload()` 補業務欄位。型別上，後掛的同名欄位會蓋住前面的。

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

入參形態和 `body()` / `query()` 一樣：欄位表、`rule.object()`、標量、`schema(...)` 都可以。生成 [AsyncAPI](/zh-TW/asyncapi/) 時，這裡的宣告會寫進入站 message；漏掛則文件裡這段是空的，執行時卻仍可用 `rawPayload` 糊弄——聯調時很難發現契約缺了。

::: tip
限流觸發、鑑權失敗等業務錯誤，習慣上也回推 `event: 'error'`（或你在 [emit](/zh-TW/websocket/emit) 裡宣告的專用事件）。前端只監聽少數幾個出口，心智更簡單。
:::

## 下一步

- [出站 emit](/zh-TW/websocket/emit)
- [事件路由](/zh-TW/websocket/channel)
- [驗證器快速上手](/zh-TW/validators/)
