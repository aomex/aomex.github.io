---
outline: deep
---

# 請求限速

有人連著不放、瘋狂 `send`——WebSocket 限的是**每條入站訊息**（不是連線數）。用 `@aomex/rate-limit/websocket` 的 `websocketRateLimit()`：掛在 `channels()` **前面**，超限時回推一條 `event: 'error'`，**不**進業務，連線保持開啟（不斷開，避免立刻重連再刷）。

```bash
pnpm add @aomex/rate-limit
# 多副本共享计数时：
pnpm add @aomex/rate-limit-redis-store
```

## 先擋住刷屏

時間窗用 `window`（毫秒數或 `'10s'` / `'1 minute'` 這類可讀時長），次數用 `limit`。預設按 `ctx.client.request.ip` 計數——同一 IP 開多條連線，配額是共享的。`ctx.client.request` 握手時就會有，不必擔心空：

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

不傳時預設是 1 小時 / 2500 次，多數聊天場景偏松；上面這種「10 秒 30 條」更適合擋住刷屏機器人。

## 按登入使用者計、白名單

想按使用者計，自己寫 `id`；返回 `false` 表示這條訊息不限速。內網除錯可用 `allowList` 跳過；已封號可用 `denyList` 直接拒絕。超限文案用 `errorMessage` 覆蓋（預設走 i18n「請求過於頻繁」）：

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

## 多副本：Redis

和 HTTP 側用同一套 `RateLimitRedisStore`。就算塞進同一個 store 實例，鍵字首也不同（`aomex-rate-limit:ws:…`），配額不會和 HTTP 限流互相吃掉。真實 IP 依賴 Web 應用上的 `proxyIP`（握手請求走同一套）。

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

## 下一步

- [濫用防護](/zh-TW/websocket/abuse)
- [應用入口](/zh-TW/websocket/)
- [事件路由](/zh-TW/websocket/channel)
