---
outline: deep
---

# 訪問日誌

即時通道沒有「URL + 狀態碼」，但你仍然想知道：哪個 IP、哪條連線、剛處理了什麼事件、花了多久。用 `@aomex/access-log/websocket` 的 `websocketAccessLog()`：每條入站訊息在中介軟體鏈跑完（含拋錯）後打一行。

```bash
pnpm add @aomex/access-log
```

## 先看每條入站訊息

掛在 `channels()` **前面**，否則打不到業務處理完的那一行。預設格式是 `[ip] [clientId] [event] [duration]`，打到控制台：

```typescript
import { websocketAccessLog } from '@aomex/access-log/websocket';
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';

new WebsocketApp({
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  transport: new WsTransport(),
  mount: [websocketAccessLog(), channels('./src/channels')], // [!code highlight]
});
```

## 改格式、拼業務欄位

令牌用 `WebsocketAccessLogToken`。`customTokens` 拿到的是 WebSocket 的 ctx，可以從 `client.data` 裡取你之前存的業務欄位。需要落盤時換 `FileTransport`：

```typescript
import {
  WebsocketAccessLogToken,
  websocketAccessLog,
} from '@aomex/access-log/websocket';
import { FileTransport } from '@aomex/logger';

websocketAccessLog({ // [!code focus:14]
  format: [
    WebsocketAccessLogToken.event,
    WebsocketAccessLogToken.clientId,
    '[room]',
    WebsocketAccessLogToken.duration,
  ].join(' '),
  transports: [new FileTransport({ file: './logs/ws-access.log' })],
  customTokens: {
    room: (ctx) => {
      return String(ctx.client.data['room'] ?? '-');
    },
  },
});
```

適合看事件分佈和慢處理，**不要**當成敏感操作的唯一審計。

## 下一步

- [應用入口](/zh-TW/websocket/)
- [事件路由](/zh-TW/websocket/channel)
- 分級出口：[日誌](/zh-TW/core/logger)
