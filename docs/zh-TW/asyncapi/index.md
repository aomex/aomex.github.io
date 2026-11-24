---
outline: deep
---

# 生成 AsyncAPI

OpenAPI 描述的是 HTTP 介面；即時通道對應的是 **AsyncAPI**。你在 Channel 上已經用 `payload()` / `emit()` 聲明瞭進出站形狀——生成器把這些宣告掃成一份 AsyncAPI 3.x 文件，給前端、對接方，或丟進 [AsyncAPI UI](/zh-TW/asyncapi/asyncapi-ui) 瀏覽。

沒掛 payload / emit 的事件，文件裡對應段落會是空的。服務照樣能跑，只是契約不完整，聯調時對方只能猜。

```bash
pnpm add @aomex/asyncapi-generator
```

## 先在 Channel 上把契約寫全

入站靠 `payload()`，出站靠 `emit()`。執行時校驗和型別收窄跟文件是同一份來源——改一處，兩邊一起變。

```typescript
// src/channels/chat.channel.ts
import { Channel, emit, payload } from '@aomex/websocket';
import { rule } from '@aomex/common';

export const channel = new Channel();

channel.on('chat.send', { // [!code focus:18]
  mount: [
    payload({
      roomId: rule.string(),
      text: rule.string().max(2000),
    }),
    emit({
      event: 'chat.message',
      description: '房间内聊天消息',
      data: {
        from: rule.string(),
        text: rule.string(),
      },
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

## 腳本里直接生成

`generateAsyncapi` 接受 Channel 目錄（或例項陣列）。`docs.asyncapi` 版本必須你自己寫（`3.0.0` 或 `3.1.0`），生成器不會猜：

```typescript
import { writeFile } from 'node:fs/promises';
import { generateAsyncapi } from '@aomex/asyncapi-generator';

const document = await generateAsyncapi({ // [!code focus:8]
  channels: './src/channels',
  docs: {
    asyncapi: '3.1.0',
    info: { title: 'Realtime', version: '1.0.0' },
  },
});

await writeFile('asyncapi.json', JSON.stringify(document, null, 2));
```

需要補 `servers` 之類生成器管不到的欄位時，在 `fix` 裡改 Document：

```typescript
await generateAsyncapi({
  channels: './src/channels',
  docs: {
    asyncapi: '3.1.0',
    info: { title: 'Realtime', version: '1.0.0' },
  },
  fix: (data) => { // [!code focus:9]
    data.servers = {
      production: {
        host: 'api.example.com',
        pathname: '/ws',
        protocol: 'wss',
      },
    };
  },
});
```

## 用 Console 落盤（給 CI 用）

和 OpenAPI 落盤同一套路：掛到 `ConsoleApp`，終端跑一條命令。`commandName` 預設就是 `asyncapi`；`saveToFile` 預設 `asyncapi.json`，也可寫成 `.yaml` / `.yml`（按副檔名選格式）。

```typescript
import { asyncapi } from '@aomex/asyncapi-generator';
import { commanders, ConsoleApp } from '@aomex/console';

const app = new ConsoleApp({
  services,
  logger: services.logger,
  language: 'zh-CN',
  mount: [ // [!code focus:12]
    asyncapi({
      commandName: 'asyncapi',
      channels: './src/channels',
      docs: {
        asyncapi: '3.1.0',
        info: { title: 'Realtime', version: '1.0.0' },
      },
      saveToFile: 'asyncapi.json',
    }),
    commanders('./src/commanders'),
  ],
});
```

```bash
npx aomex asyncapi
```

跑的時候終端會轉幾步（找檔案 → 解析 → 儲存 → 校驗）。自己在腳本里呼叫優先用上面的 `generateAsyncapi`，沒有 spinner、更好斷言。

## 下一步

- [AsyncAPI UI](/zh-TW/asyncapi/asyncapi-ui) —— 瀏覽器裡翻這份文件
- [出站 emit](/zh-TW/websocket/emit) / [入站 payload](/zh-TW/websocket/payload)
- [事件路由](/zh-TW/websocket/channel)
