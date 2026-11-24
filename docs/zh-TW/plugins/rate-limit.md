---
outline: deep
---

# 請求限流

在時間窗內按客戶端標識計數，超限返回 **429**，用來擋刷介面和突發流量。

**按 IP / 連線的全站限流，生產優先用 Nginx**（如 `limit_req_zone` / `limit_req`）：請求還沒進 Node 就被擋住，多副本也不用先上 Redis。`@aomex/rate-limit` 更適合：**按使用者 / API Key 等業務鍵**、登入簡訊等單路由收緊，或本地沒有反代時先頂一陣。

預設**程序內記憶體**計數——單機夠用；多副本且必須在應用內計數時要換 Redis，否則總限額約等於 `limit × 例項數`。

```bash
pnpm add @aomex/rate-limit
# 多实例且必须在应用内共享计数：
pnpm add @aomex/rate-limit-redis-store
```

## 掛上全站

邊緣已經按 IP 限過的話，應用裡不必再掛一層全站 `rateLimit()`。需要按業務鍵、或本地直連時，把 `rateLimit()` 放在 mount 靠前：視窗內超限直接 **429**，不必在每個 action 裡數次數。

```typescript
import { rateLimit } from '@aomex/rate-limit';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:7]
    rateLimit({
      limit: 100,
      window: 60_000, // [!code highlight]
    }),
    routers('./src/routers'),
  ],
});
```

`window` 是計數視窗（毫秒數或 `'1 hour'`、`'30s'` 這類可讀時長，預設 1 小時）；`limit` 是視窗內允許次數（預設 2500）。不配時就是「按 IP、一小時 2500 次」——本地直連可以松一點，避免排障時把自己鎖死。

普通 WebMiddleware；超限拋 HTTP 錯誤，狀態 **429**。響應裡會帶 `X-RateLimit-*` 頭；傳 `headers: false` 可關掉。

## 按 Key / 使用者計，放過健康檢查

預設 `id` 用 `ctx.request.ip`。想按 API Key 或登入使用者分桶，自己寫 `id`；返回 `false` 表示本條不計數（健康檢查常用）。內網要整段跳過，用 `allowList`；要直接擋掉某些 IP，用 `denyList`（命中拋 **403**，不走計數）。

```typescript
rateLimit({
  limit: 60,
  window: 60_000,
  id: (ctx) => { // [!code highlight]
    if (ctx.request.pathname === '/health') {
      return false;
    }
    const key = ctx.request.headers['x-api-key'];
    if (typeof key === 'string') {
      return key;
    }
    return ctx.request.ip;
  },
  allowList: (ctx) => {
    return ctx.request.ip === '127.0.0.1';
  },
});
```

只按 IP 限流時，NAT 後面整棟辦公樓共用一個鍵，容易誤傷；登入、發簡訊這類更適合按使用者或 API Key。全站限額過緊時，熱點路由單獨 mount 更常見。

## 只限單條路由

登入、驗證碼這類介面，全站限額往往太鬆。把 `rateLimit()` 掛到該路由的 mount 上，和 `body()` 並列即可。

```typescript
import { body } from '@aomex/web';
import { rule } from '@aomex/common';

router.post('/login', {
  mount: [
    rateLimit({ limit: 10, window: 60_000 }), // [!code highlight]
    body({ email: rule.email(), password: rule.string() }),
  ],
  action: async (ctx) => {
    /* ... */
  },
});
```

## 生產多副本：換 Redis

多 Pod 仍用預設記憶體 store，各例項各算各的，總配額會翻倍。共享計數時換成 `@aomex/rate-limit-redis-store`。

構造時只傳 `RedisOptions`（`host` / `port` 等；型別可從本包引入），不要傳入已建好的 `Redis` 例項。`ioredis` 已隨包裝好，不必再單獨加依賴。store 內部會 `lazyConnect`，由 `rateLimit()` 經 [`registerLifecycle`](/zh-TW/core/service#生命週期鉤子) 在程序側連上 / 斷開。

```typescript
import { RateLimitRedisStore } from '@aomex/rate-limit-redis-store';

rateLimit({
  store: new RateLimitRedisStore({ // [!code highlight]
    host: '127.0.0.1',
    port: 6379,
  }),
  limit: 500,
  window: 3_600_000,
  id: (ctx) => {
    const key = ctx.request.headers['x-api-key'];
    if (typeof key === 'string') {
      return key;
    }
    return ctx.request.ip;
  },
});
```

預設記憶體 store 也可從 `@aomex/rate-limit/memory` 顯式引入；關停時會清空程序內計數。自建儲存需實現包內 `RateLimitStore` 的原子 `getAndSet`；需要連庫 / 關連線時可覆蓋 `onInit` / `onDestroy`（`rateLimit()` 會自動登記）。簽名以型別定義為準。

::: tip
生產有 Nginx 時：**優先** `limit_req` 等做 IP / 連線限流；應用層留給登入、簡訊、按 Key 的配額。別和閘道器用同一套過緊的 IP 限額疊到誤傷。
:::

## 下一步

- 蜜罐 / 錯誤累計 / 封 IP：[濫用防護](/zh-TW/plugins/abuse)
- WebSocket 入站訊息限速：[請求限速（WebSocket）](/zh-TW/websocket/rate-limit)
- 真實 IP（限流鍵）：[Web 應用入口](/zh-TW/web/) 裡 proxyIP
- 身份維度：[Auth](/zh-TW/plugins/auth)
- 錯誤形態：[錯誤格式](/zh-TW/web/errors)
