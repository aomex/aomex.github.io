---
outline: deep
---

# アクセスログ

リアルタイムチャネルに「URL + ステータスコード」はありませんが、それでも知りたいことがあります：どの IP、どの接続、いま何のイベントを処理し、何にどれだけかかったか。`@aomex/access-log/websocket` の `websocketAccessLog()` を使います。各受信メッセージがミドルウェア鎖を走り切ったあと（throw も含む）一行を打ちます。

```bash
pnpm add @aomex/access-log
```

## まず各受信メッセージを見る

`channels()` の**手前**に掛けます。そうしないと業務処理完了後の一行が取れません。既定フォーマットは `[ip] [clientId] [event] [duration]` で、コンソールへ出ます：

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

## 形式を変え、業務フィールドを足す

トークンは `WebsocketAccessLogToken` です。`customTokens` が受け取るのは WebSocket の ctx で、以前 `client.data` に入れた業務フィールドを取れます。ファイルへ落としたいときは `FileTransport` に換えます：

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

イベント分布や遅い処理を見るのに向きます。**機密操作の唯一の監査**にはしないでください。

## 次のステップ

- [アプリケーション入口](/ja/websocket/)
- [イベントルーティング](/ja/websocket/channel)
- 段階付き出口：[ログ](/ja/core/logger)
