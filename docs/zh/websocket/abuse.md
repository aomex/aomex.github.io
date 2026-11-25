---
outline: deep
---

# 滥用防护

实时通道上的探测，常见是乱扫「根本不该存在的事件名」。`@aomex/abuse` 的 `.socket()` 做两件事：检查 IP 是否已被封；用 `socket-events` 策略给诱饵事件计数，满额封 IP。

封禁态和 HTTP 侧是**同一份**（同一个 `Abuse` 实例、同一个 `store`）：Web 蜜罐封掉的 IP，连 WebSocket 也会被拒。握手 IP 依赖 Web 应用上的 `proxyIP`，配错等于封错人。

```bash
pnpm add @aomex/abuse
# 还需已有的 @aomex/cache（及生产用的 Redis 适配器）
```

## 先挂事件名蜜罐

`new Abuse(...)` 得到的是服务，不是直接能塞进 mount 的中间件。WebSocket 侧用 **`abuse.socket()`**，挂在 `channels()` 前面。若 HTTP 应用里已经 `new` 过一份，**复用同一个实例**即可，不必再 new。本地用 memory；多副本换 Redis 适配器。

::: warning
调用前须已 `import '@aomex/websocket'`（注册 `middleware.socket`）。
:::

把「诱饵事件」写进 `socket-events` 策略的 `events`：字符串支持 `*`，也可以写正则（整串匹配 `ctx.event`）。命中后按 IP 计数，满额封禁。`events` 不能为空，创建时就会校验。

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

## 被封之后回什么

IP 已封禁，或 `socket-events` 刚撞线满额时：先回推 `{ event: 'error', data: { message } }`，再以关闭码 **1008**（Policy Violation）断开——封禁不是软限流，连接不应继续占着。`errorMessage` 既是 error 帧文案，也会作为 close reason（传输层会截断过长 reason）。白名单在 `.socket()` 上配——`bypass` 返回 `true` 则跳过检查：

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

## 在 Channel 里上报

`ip-abuse` / `user-abuse` 策略若已在构造 `Abuse` 时配好，Channel 的 action 里也能调同一套 API（例如发现刷屏用户）。`ctx.client.request` 握手时就有，直接取 IP：

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

策略怎么声明、`onBanUser` / `blockIP` 等 API，与 HTTP 侧同一套；路径蜜罐、状态码累计见 Web 应用下的 [滥用防护](/zh/plugins/abuse)。

## 下一步

- [请求限速](/zh/websocket/rate-limit)
- [应用入口](/zh/websocket/)
- [事件路由](/zh/websocket/channel)
