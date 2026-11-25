---
outline: deep
---

# アクセスログ

リアルタイムチャネルに「URL + ステータスコード」はないが、どの IP・どの接続がどのイベントを処理し何 ms かかったかは知りたい。`@aomex/access-log/websocket` の `websocketAccessLog()`：各入站メッセージはミドルウェアチェーン完了後（例外含む）に 1 行ログ。

```bash
pnpm add @aomex/access-log
```

## まず各入站メッセージ

`channels()` の**前**に掛ける。そうでないと業務処理後の行が出ない。デフォルト形式 `[ip] [clientId] [event] [duration]`、コンソール出力：

```typescript
import { websocketAccessLog } from '@aomex/access-log/websocket';
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';
import { logger } from '@/services/logger.service';

new WebsocketApp({
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  transport: new WsTransport(),
  mount: [websocketAccessLog(), channels('./src/channels')], // [!code highlight]
});
```

## フォーマットと業務フィールド

トークンは `WebsocketAccessLogToken`。`customTokens` の ctx は WebSocket 用。`client.data` に保存した業務フィールドを取れる。ファイル出力は `FileTransport`：

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

イベント分布や遅い処理の把握向け。**機密操作の唯一の監査ログにはしない**。

## 次のステップ

- [アプリ入口](/ja/websocket/)
- [イベントルート](/ja/websocket/channel)
- ログレベル：[ログ](/ja/core/logger)