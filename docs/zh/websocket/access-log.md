---
outline: deep
---

# 访问日志

实时通道没有「URL + 状态码」，但你仍然想知道：哪个 IP、哪条连接、刚处理了什么事件、花了多久。用 `@aomex/access-log/websocket` 的 `websocketAccessLog()`：每条入站消息在中间件链跑完（含抛错）后打一行。

```bash
pnpm add @aomex/access-log
```

## 先看每条入站消息

挂在 `channels()` **前面**，否则打不到业务处理完的那一行。默认格式是 `[ip] [clientId] [event] [duration]`，打到控制台：

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

## 改格式、拼业务字段

令牌用 `WebsocketAccessLogToken`。`customTokens` 拿到的是 WebSocket 的 ctx，可以从 `client.data` 里取你之前存的业务字段。需要落盘时换 `FileTransport`：

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

适合看事件分布和慢处理，**不要**当成敏感操作的唯一审计。

## 下一步

- [应用入口](/zh/websocket/)
- [事件路由](/zh/websocket/channel)
- 分级出口：[日志](/zh/core/logger)
