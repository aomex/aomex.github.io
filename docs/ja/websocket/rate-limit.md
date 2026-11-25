---
outline: deep
---

# レート制限

接続数ではなく**各入站メッセージ**を制限する——誰かが `send` を連打しているとき。`@aomex/rate-limit/websocket` の `websocketRateLimit()` を `channels()` の**前**に：超過時は `event: 'error'` を push し、業務には入らず、接続は開いたまま（即再接続の洪水を避ける）。

```bash
pnpm add @aomex/rate-limit
# レプリカ間でカウント共有：
pnpm add @aomex/rate-limit-redis-store
```

## まず連打を止める

`window` はミリ秒または `'10s'` / `'1 minute'` など。`limit` は回数。デフォルトは `ctx.client.request.ip` でカウント——同一 IP の複数接続でクォータ共有。`ctx.client.request` はハンドシェイク時からある：

```typescript
import { websocketRateLimit } from '@aomex/rate-limit/websocket';
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';
import { logger } from '@/services/logger.service';

new WebsocketApp({
  logger,
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

省略時デフォルトは 1 時間 / 2500 回で多くのチャットには緩い。上の「10 秒 30 件」は bot 連打向け。

## ログインユーザー単位・ホワイトリスト

ユーザー単位は `id` を自前実装；`false` 返却でそのメッセージは無制限。社内デバッグは `allowList`；既バンは `denyList`。超過時の文言は `errorMessage`（デフォルトは i18n の「リクエストが多すぎます」相当）：

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
  errorMessage: '送信が多すぎます。しばらくしてから再度お試しください',
});
```

## レプリカ：Redis

HTTP と同じ `RateLimitRedisStore`。同一 store でもキープレフィックスは別（`aomex-rate-limit:ws:…`）、HTTP 限流とクォータは食い合わない。実 IP は Web の `proxyIP`（ハンドシェイクは同設定）。

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

- [悪用対策](/ja/websocket/abuse)
- [アプリ入口](/ja/websocket/)
- [イベントルート](/ja/websocket/channel)