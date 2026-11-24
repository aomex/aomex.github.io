---
outline: deep
---

# リクエストレート制限

繋がったまま `send` を連打する相手がいます——WebSocket が制限するのは**各受信メッセージ**（接続数ではありません）。`@aomex/rate-limit/websocket` の `websocketRateLimit()` を使い、`channels()` の**手前**に掛けます。上限超過時は `event: 'error'` を返し、業務には**入りません**。接続は開いたままです（切らないことで、すぐ再接続してまた叩くのを避けます）。

```bash
pnpm add @aomex/rate-limit
# 多副本共享计数时：
pnpm add @aomex/rate-limit-redis-store
```

## まず連打を止める

時間窓は `window`（ミリ秒、または `'10s'` / `'1 minute'` のような読みやすい長さ）、回数は `limit` です。既定では `ctx.client.request.ip` 単位で数えます——同じ IP が複数接続を開いてもクォータは共有です。`ctx.client.request` はハンドシェイク時からあるので、空を心配する必要はありません：

```typescript
import { websocketRateLimit } from '@aomex/rate-limit/websocket';
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';

new WebsocketApp({
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  transport: new WsTransport(),
  mount: [ // [!code focus:6]
    websocketRateLimit({
      limit: 30,
      window: '10s', // [!code highlight]
    }),
    channels('./src/channels'),
  ],
});
```

未指定時の既定は 1 時間 / 2500 回で、多くのチャットには緩いです。上のような「10 秒 30 件」の方が連打ボットを止めやすいです。

## ログインユーザー単位、ホワイトリスト

ユーザー単位にしたいときは自分で `id` を書きます。`false` を返すとそのメッセージは制限しません。社内デバッグでは `allowList` でスキップ；BAN 済みは `denyList` で即拒否できます。超過時の文言は `errorMessage` で上書き（既定は i18n の「リクエストが頻繁すぎます」）：

```typescript
websocketRateLimit({ // [!code focus:18]
  limit: 60,
  window: '1 minute',
  id: (ctx) => {
    const userId = ctx.client.data['userId'];
    if (typeof userId === 'string') {
      return userId;
    }
    return ctx.client.request.ip;
  },
  allowList: (ctx) => {
    return ctx.client.request.ip === '127.0.0.1';
  },
  denyList: (ctx) => {
    return ctx.client.data['banned'] === true;
  },
  errorMessage: '发送过于频繁，稍后再试',
});
```

## 複数レプリカ：Redis

HTTP 側と同じ `RateLimitRedisStore` を使います。同じ store インスタンスに入れても、キー接頭辞が違う（`aomex-rate-limit:ws:…`）ので、クォータが HTTP 制限と食い合いません。実 IP は Web アプリの `proxyIP` に依存します（ハンドシェイクリクエストが同じ仕組みを通ります）。

```typescript
import { RateLimitRedisStore } from '@aomex/rate-limit-redis-store';

websocketRateLimit({ // [!code focus:8]
  store: new RateLimitRedisStore({
    host: '127.0.0.1',
    port: 6379,
  }),
  limit: 30,
  window: '10s',
});
```

## 次のステップ

- [濫用防止](/ja/websocket/abuse)
- [アプリケーション入口](/ja/websocket/)
- [イベントルーティング](/ja/websocket/channel)
