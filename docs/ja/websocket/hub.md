---
outline: deep
---

# マルチマシン Hub

Hub が覚えるのは「誰がどの部屋にいるか」と「ブロードキャスト時にどう扇ぎ出すか」です。既定のメモリ Hub が知るのは**今この Node プロセス**内の接続だけ——ローカル開発には十分です。

いつ Redis Hub に換える必要があるか？

- 本番で複数の Web レプリカを走らせ、ユーザーが別マシンに振り分けられる
- Console（や他プロセス）からも `ws.room(...).send` し、Web プロセス上でまだ繋がっているブラウザへ送りたい

転送層（ws / Socket.IO）と Hub は**別々の担当**です。クライアントプロトコルを換えても Hub は換えなくてよく、マルチマシン化は Hub だけ換えます。

メッセージは引き続きベストエフォートです。Redis `PUBLISH` が成功しても、各マシンが扇ぎ切った保証も、ブラウザが表示した保証もありません。

## 既定で十分：MemoryHub

`hub` を渡さないと自動でメモリ実装になります。単機・本機結合試験はそのままで構いません——入口ページの `new WebsocketApp({ ... })` がすでにこの状態です。

制限を覚えてください：プロセス A の `room().send` は、プロセス B 上の接続には**届きません**。Web と Console が別プロセスなら、Console からいくら send してもブラウザは受け取れません。

## マルチマシンへ：RedisHub

```bash
pnpm add @aomex/websocket-redis-hub
```

各マシンは引き続きローカルで「本機にどの接続があり、それぞれどの部屋にいるか」を持ちます。マシンを跨ぐブロードキャストは Redis Pub/Sub です。ある部屋に本機の人がいなくなれば対応チャンネルを購読解除し、空購読を避けます。

`host` / `port` / パスワードなどは普段の ioredis と同じです。複数プロジェクトが同じ Redis を共有するときは、必ず `channel`（Pub/Sub チャンネル接頭辞、既定 `aomex:websocket:hub`）を衝突しない名前にしてください。`fanoutBatchSize` は本機が一回に扇ぎ出す接続数で、通常は触りません。

```typescript
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';
import { RedisHub } from '@aomex/websocket-redis-hub';

export const ws = new WebsocketApp({
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  transport: new WsTransport(),
  hub: new RedisHub({ // [!code focus:5]
    host: '127.0.0.1',
    port: 6379,
    channel: 'aomex:websocket:hub',
    fanoutBatchSize: 512,
  }),
  mount: [channels('./src/channels')],
});
```

実際のチャンネルは `{接頭辞}:a`（全員向け）と `{接頭辞}:r:{部屋名}` です。**相互にやり取りするすべてのプロセス**（各 Web レプリカ、送信する Console）は、同じ Redis・同じ `channel` 接頭辞である必要があります。

::: warning
Socket.IO 転送を使っていても、Socket.IO 公式の Redis adapter は**載せない**でください。部屋とブロードキャストは aomex の `hub` だけを見ます。二系統を重ねるのは地雷です。
:::

## Console からクロスプロセスで一送り

入口ページと同じ型です：`ws` は単独ファイルで export；Web プロセスが `attach` を担当；Console は**import するだけで、絶対に attach しない**。双方の構築時に同じ `RedisHub` 設定を渡します：

```typescript
// Console 指令里
import { ws } from '../ws.js';

await ws.room(`order:${orderId}`).send('order.updated', order);
await ws.all.send('system.notice', { text: '今晚 23:00 维护' });
```

送信前に Hub の準備完了を待ちます。そのときオフラインのクライアントには届きません——次回ページを開いたときに HTTP で状態を揃えれば十分です。

## 次のステップ

- [アプリケーション入口](/ja/websocket/) —— attach と送信の書き方
- [転送層](/ja/websocket/transport)
- [マルチプロセスとスケールアウト](/ja/advanced/cluster)
