---
outline: deep
---

# マルチインスタンス Hub

Hub は「誰がどのルームにいるか」「ブロードキャストをどう扇ぐか」を記録する。デフォルトのメモリ Hub は**この Node プロセス内**の接続しか知らない——ローカル開発には十分。

いつ Redis Hub に替えるか？

- 本番で Web レプリカが複数あり、ユーザーが別マシンに当たる
- Console（ほかプロセス）から `ws.room(...).send` で Web プロセス上のブラウザへ push したい

トランスポート（ws / Socket.IO）と Hub は**別物**：クライアントプロトコルを変えても Hub は必須ではない；マルチインスタンスでは Hub だけ差し替え。

メッセージはベストエフォート：Redis `PUBLISH` 成功 ≠ 全マシンで扇ぎ終わり ≠ ブラウザ表示済み。

## デフォルトで十分：MemoryHub

`hub` 省略時はメモリ実装。単機・ローカル連携はこのまま——入口の `new WebsocketApp({ ... })` が既にこの状態。

制限：プロセス A の `room().send` はプロセス B の接続に**届かない**。Web と Console が別プロセスなら、Console で send してもブラウザは受け取れない。

## マルチインスタンス：RedisHub

```bash
pnpm add @aomex/websocket-redis-hub
```

各マシンはローカルで「自機接続と所属ルーム」を維持；マシン間ブロードキャストは Redis Pub/Sub。ルームに自機クライアントがいなければ該当チャンネル購読をやめ、空購読を避ける。

`host` / `port` / パスワードは ioredis 設定と同様。複数プロジェクトが同一 Redis なら `channel`（Pub/Sub プレフィックス、デフォルト `aomex:websocket:hub`）を衝突しない名前に。`fanoutBatchSize` は自機で一度に扇ぐ接続数。通常は触らない。

```typescript
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';
import { RedisHub } from '@aomex/websocket-redis-hub';
import { logger } from '@/services/logger.service';

export const ws = new WebsocketApp({
  logger,
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

実チャンネルは `{プレフィックス}:a`（全員）と `{プレフィックス}:r:{ルーム名}`。**相互に届けたい全プロセス**（各 Web レプリカ、push する Console）は同一 Redis・同一 `channel` プレフィックス。

::: warning
Socket.IO トランスポートでも Socket.IO 公式 Redis adapter は**掛けない**。ルームとブロードキャストは aomex の `hub` のみ。二重は地雷。
:::

## Console からクロスプロセス push

入口と同じ型：`ws` を別ファイル export；Web プロセスが `attach`；Console は **import のみ、attach しない**。両方の構築で同じ `RedisHub` 設定：

```typescript
// Console コマンド内
import { ws } from '@/ws';

await ws.room(`order:${orderId}`).send('order.updated', order);
await ws.all.send('system.notice', { text: '今晚 23:00 维护' });
```

送信前に Hub の準備を待つ。オフラインのクライアントは受け取れない——次回ページ表示で HTTP から状態を揃える。

## 次のステップ

- [アプリ入口](/ja/websocket/) — attach と push の書き方
- [トランスポート層](/ja/websocket/transport)
- [マルチプロセスとスケール](/ja/advanced/cluster)