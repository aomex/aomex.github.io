---
outline: deep
---

# 悪用対策

リアルタイムチャネルでは、存在しないイベント名を総当たりするスキャンがよくある。`@aomex/abuse` の `.socket()` は二つ：IP が既にブロックされているか確認；`socket-events` 戦略でおとりイベントをカウントし、上限で IP をブロック。

ブロック状態と HTTP 側は**同一**（同じ `Abuse` インスタンス、同じ `store`）：Web のハニーポットでブロックした IP は WebSocket も拒否される。ハンドシェイク IP は Web アプリの `proxyIP` に依存。誤設定は人違い。

```bash
pnpm add @aomex/abuse
# 既存の @aomex/cache（本番は Redis アダプター）も必要
```

## まずイベント名ハニーポット

`new Abuse(...)` はサービスであり、直接 `mount` に入る middleware ではない。WebSocket 側は **`abuse.socket()`** を `channels()` の前に。HTTP で既に `new` したインスタンスがあれば**同じものを再利用**。ローカルは memory。複数レプリカは Redis アダプター。

::: warning
呼び出し前に `import '@aomex/websocket'`（`middleware.socket` 登録）が必要。
:::

「おとりイベント」を `socket-events` 戦略の `events` に書く：文字列は `*` 可、正規表現も可（`ctx.event` に全体マッチ）。命中で IP カウント、上限でブロック。`events` は空不可。作成時に検証される。

```typescript
import { Abuse } from '@aomex/abuse';
import { Caching } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';
import { logger } from '@/services/logger.service';

const cache = new Caching(new CacheMemoryAdapter());

const abuse = new Abuse({
  store: cache,
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
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  transport: new WsTransport(),
  mount: [
    abuse.socket(),
    channels('./src/channels'),
  ],
});
```

## ブロック後の応答

IP 既ブロック、または `socket-events` が上限到達：まず `{ event: 'error', data: { message } }` を push し、クローズコード **1008**（Policy Violation）で切断——ブロックはソフトレート制限ではなく、接続を占有させない。`errorMessage` は error フレームの文言であり close reason にもなる（長すぎる reason は伝送層で切られる）。ホワイトリストは `.socket()` の `bypass` — `true` ならチェック省略：

```typescript
mount: [
  abuse.socket({ // [!code focus:6]
    bypass: (ctx) => {
      return ctx.client.request.ip === '127.0.0.1';
    },
    errorMessage: 'アクセスが制限されています',
  }),
  channels('./src/channels'),
],
```

## Channel 内での報告

`ip-abuse` / `user-abuse` を `Abuse` 構築時に設定済みなら、Channel の action でも同 API（例：スパムユーザー）。`ctx.client.request` はハンドシェイク時からある：

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

戦略の宣言、`onBanUser` / `blockIP` などは HTTP 側と同一。パス蜜罐・ステータス累計は Web の [悪用対策](/ja/plugins/abuse)。

## 次のステップ

- [レート制限](/ja/websocket/rate-limit)
- [アプリ入口](/ja/websocket/)
- [イベントルート](/ja/websocket/channel)