---
outline: deep
---

# 请求限速

有人连着不放、疯狂 `send`——WebSocket 限的是**每条入站消息**（不是连接数）。用 `@aomex/rate-limit/websocket` 的 `websocketRateLimit()`：挂在 `channels()` **前面**，超限时回推一条 `event: 'error'`，**不**进业务，连接保持打开（不断开，避免立刻重连再刷）。

```bash
pnpm add @aomex/rate-limit
# 多副本共享计数时：
pnpm add @aomex/rate-limit-redis-store
```

## 先挡住刷屏

时间窗用 `window`（毫秒数或 `'10s'` / `'1 minute'` 这类可读时长），次数用 `limit`。默认按 `ctx.client.request.ip` 计数——同一 IP 开多条连接，配额是共享的。`ctx.client.request` 握手时就会有，不必担心空：

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

不传时默认是 1 小时 / 2500 次，多数聊天场景偏松；上面这种「10 秒 30 条」更适合挡住刷屏机器人。

## 按登录用户计、白名单

想按用户计，自己写 `id`；返回 `false` 表示这条消息不限速。内网调试可用 `allowList` 跳过；已封号可用 `denyList` 直接拒绝。超限文案用 `errorMessage` 覆盖（默认走 i18n「请求过于频繁」）：

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

和 HTTP 侧用同一套 `RateLimitRedisStore`。就算塞进同一个 store 实例，键前缀也不同（`aomex-rate-limit:ws:…`），配额不会和 HTTP 限流互相吃掉。真实 IP 依赖 Web 应用上的 `proxyIP`（握手请求走同一套）。

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

- [滥用防护](/zh/websocket/abuse)
- [应用入口](/zh/websocket/)
- [事件路由](/zh/websocket/channel)
