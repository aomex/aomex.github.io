---
outline: deep
---

# 濫用防止

リアルタイムチャネル上の探査でよくあるのは、「そもそも存在しないはずのイベント名」を乱スキャンすることです。`@aomex/abuse` の `.socket()` は二つのことをします：IP がすでに BAN 済みかを見る；`socket-events` 戦略でおとりイベントを数え、満額で IP を BAN します。

BAN 状態は HTTP 側と**同じもの**です（同じ `createAbuse` インスタンス、同じ `store`）：Web のハニーポットが BAN した IP は、WebSocket でも拒否されます。ハンドシェイク IP は Web アプリの `proxyIP` に依存し、配り間違えると別人を BAN します。

```bash
pnpm add @aomex/abuse
# 还需已有的 @aomex/cache（及生产用的 Redis 适配器）
```

## まずイベント名ハニーポットを掛ける

`createAbuse` が返すのはサービスで、そのまま mount に挿せるミドルウェアではありません。WebSocket 側は **`abuse.socket()`** を使い、`channels()` の手前に掛けます。HTTP アプリですでに `createAbuse` したインスタンスがあるなら、**同じオブジェクトを再利用**すればよく、もう一度 new する必要はありません。ローカルは memory；複数レプリカでは Redis アダプタに換えます。

::: warning
呼び出し前に `import '@aomex/websocket'` 済みであること（`middleware.socket` を登録するため）。
:::

「おとりイベント」を `socket-events` 戦略の `events` に書きます。文字列は `*` をサポートし、正規表現でも書けます（文字列全体が `ctx.event` にマッチ）。ヒット後は IP 単位で数え、満額で BAN。`events` は空にできず、作成時に検証されます。

```typescript
import { createAbuse } from '@aomex/abuse';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';

const abuse = createAbuse({
  store: new CacheMemoryAdapter(),
  strategies: [
    { // [!code focus:7]
      strategy: 'socket-events',
      events: ['admin.destroy', 'debug.*', /^internal\./],
      limit: 1,
      window: '1 hour',
      blockFor: '1 day',
    },
  ],
});

new WebsocketApp({
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  transport: new WsTransport(),
  mount: [
    abuse.socket(),
    channels('./src/channels'),
  ],
});
```

## BAN されたあと何が返るか

IP が既に BAN されている、または `socket-events` が満額になったとき：まず `{ event: 'error', data: { message } }` を返し、続けて終了コード **1008**（Policy Violation）で切断します——BAN はソフトなレート制限ではないので、接続を残すべきではありません。`errorMessage` は error フレームの文言であり、close reason にもなります（転送層が長すぎる reason を切り詰めることがあります）。ホワイトリストは `.socket()` で配ります——`bypass` が `true` を返すと検査をスキップ：

```typescript
mount: [
  abuse.socket({ // [!code focus:6]
    bypass: (ctx) => {
      return ctx.client.request.ip === '127.0.0.1';
    },
    errorMessage: '已限制访问',
  }),
  channels('./src/channels'),
],
```

## Channel から報告する

`ip-abuse` / `user-abuse` 戦略をすでに `createAbuse` に書いていれば、Channel の action からも同じ API を呼べます（例：連打ユーザーを見つけたとき）。`ctx.client.request` はハンドシェイク時からあるので、IP をそのまま取れます：

```typescript
channel.on('chat.send', {
  mount: [payload({ text: rule.string() })],
  action: async (ctx) => {
    if (looksLikeSpam(ctx.payload.text)) {
      await abuse.ipAbuse(ctx.client.request.ip, 'chat-spam');
    }
    // …
  },
});
```

戦略の宣言、`onBanUser` / `blockIP` などの API は HTTP 側と同じです。パスハニーポットやステータスコード累計は Web アプリ下の [濫用防止](/ja/plugins/abuse) を見てください。

## 次のステップ

- [リクエストレート制限](/ja/websocket/rate-limit)
- [アプリケーション入口](/ja/websocket/)
- [イベントルーティング](/ja/websocket/channel)
