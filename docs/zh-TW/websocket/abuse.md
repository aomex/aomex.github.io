---
outline: deep
---

# 濫用防護

即時通道上的探測，常見是亂掃「根本不該存在的事件名」。`@aomex/abuse` 的 `.socket()` 做兩件事：檢查 IP 是否已被封；用 `socket-events` 策略給誘餌事件計數，滿額封 IP。

封禁態和 HTTP 側是**同一份**（同一個 `createAbuse` 例項、同一個 `store`）：Web 蜜罐封掉的 IP，連 WebSocket 也會被拒。握手 IP 依賴 Web 應用上的 `proxyIP`，配錯等於封錯人。

```bash
pnpm add @aomex/abuse
# 还需已有的 @aomex/cache（及生产用的 Redis 适配器）
```

## 先掛事件名蜜罐

`createAbuse` 返回的是服務，不是直接能塞進 mount 的中介軟體。WebSocket 側用 **`abuse.socket()`**，掛在 `channels()` 前面。若 HTTP 應用裡已經 `createAbuse` 過一份，**複用同一個物件**即可，不必再 new。本地用 memory；多副本換 Redis 介面卡。

::: warning
呼叫前須已 `import '@aomex/websocket'`（註冊 `middleware.socket`）。
:::

把「誘餌事件」寫進 `socket-events` 策略的 `events`：字串支援 `*`，也可以寫正則（整串匹配 `ctx.event`）。命中後按 IP 計數，滿額封禁。`events` 不能為空，建立時就會校驗。

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

## 被封之後回什麼

IP 已封禁，或 `socket-events` 剛撞線滿額時：先回推 `{ event: 'error', data: { message } }`，再以關閉碼 **1008**（Policy Violation）斷開——封禁不是軟限流，連線不應繼續佔著。`errorMessage` 既是 error 幀文案，也會作為 close reason（傳輸層會截斷過長 reason）。白名單在 `.socket()` 上配——`bypass` 返回 `true` 則跳過檢查：

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

## 在 Channel 裡上報

`ip-abuse` / `user-abuse` 策略若已在 `createAbuse` 裡配好，Channel 的 action 裡也能調同一套 API（例如發現刷屏使用者）。`ctx.client.request` 握手時就有，直接取 IP：

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

策略怎麼宣告、`onBanUser` / `blockIP` 等 API，與 HTTP 側同一套；路徑蜜罐、狀態碼累計見 Web 應用下的 [濫用防護](/zh-TW/plugins/abuse)。

## 下一步

- [請求限速](/zh-TW/websocket/rate-limit)
- [應用入口](/zh-TW/websocket/)
- [事件路由](/zh-TW/websocket/channel)
