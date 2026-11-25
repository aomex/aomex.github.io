---
outline: deep
---

# 生成 AsyncAPI

OpenAPI 描述的是 HTTP 接口；实时通道对应的是 **AsyncAPI**。你在 Channel 上已经用 `payload()` / `emit()` 声明了进出站形状——生成器把这些声明扫成一份 AsyncAPI 3.x 文档，给前端、对接方，或丢进 [AsyncAPI UI](/zh/asyncapi/asyncapi-ui) 浏览。

没挂 payload / emit 的事件，文档里对应段落会是空的。服务照样能跑，只是契约不完整，联调时对方只能猜。

```bash
pnpm add @aomex/asyncapi-generator
```

## 先在 Channel 上把契约写全

入站靠 `payload()`，出站靠 `emit()`。运行时校验和类型收窄跟文档是同一份来源——改一处，两边一起变。

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

## 脚本里直接生成

`generateAsyncapi` 接受 Channel 目录（或实例数组）。`docs.asyncapi` 版本必须你自己写（`3.0.0` 或 `3.1.0`），生成器不会猜：

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

需要补 `servers` 之类生成器管不到的字段时，在 `fix` 里改 Document：

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

## 用 Console 落盘（给 CI 用）

和 OpenAPI 落盘同一套路：挂到 `ConsoleApp`，终端跑一条命令。`commandName` 默认就是 `asyncapi`；`saveToFile` 默认 `asyncapi.json`，也可写成 `.yaml` / `.yml`（按扩展名选格式）。

```typescript
import { asyncapi } from '@aomex/asyncapi-generator';
import { commanders, ConsoleApp } from '@aomex/console';
import { logger } from '@/services/logger.service';

const app = new ConsoleApp({
  services,
  logger,
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

跑的时候终端会转几步（找文件 → 解析 → 保存 → 校验）。自己在脚本里调用优先用上面的 `generateAsyncapi`，没有 spinner、更好断言。

## 下一步

- [AsyncAPI UI](/zh/asyncapi/asyncapi-ui) —— 浏览器里翻这份文档
- [出站 emit](/zh/websocket/emit) / [入站 payload](/zh/websocket/payload)
- [事件路由](/zh/websocket/channel)
