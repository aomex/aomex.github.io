---
outline: deep
---

# 請求限流

在時間窗內按客戶端標識計數，超限返回 **429**，用來擋刷介面和突發流量。

**按 IP / 連線的全站限流，生產優先用 Nginx**（如 `limit_req_zone` / `limit_req`）：請求還沒進 Node 就被擋住，多副本也不用先上 Redis。`@aomex/rate-limit` 更適合：**按使用者 / API Key 等業務鍵**、登入簡訊等單路由收緊，或本地沒有反代時先頂一陣。

預設**程序內記憶體**計數——單機夠用；多副本且必須在應用內計數時要換 Redis，否則總限額約等於 `maxRequest × 例項數`。

```bash
pnpm add @aomex/rate-limit
# 多实例且必须在应用内共享计数：
pnpm add @aomex/rate-limit-redis-store
```

## 全站掛載

邊緣已經按 IP 限過的話，應用裡不必再掛一層全站 `rateLimit()`。需要按業務鍵、或本地直連時，把 `rateLimit()` 放在 mount 靠前：視窗內超限直接 **429**，不必在每個 action 裡數次數。多副本共享計數要換 Redis store，見下文。

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
      maxRequest: 100,
      duration: 60_000, // [!code highlight]
    }),
    routers('./src/routers'),
  ],
});
```

普通 WebMiddleware；超限拋 HTTP 錯誤，狀態 **429**，不必在每條 action 裡手寫判斷。id 返回 false 表示本條不計數（健康檢查常用）。

## 計數鍵與白名單

| 選項 | 什麼時候用 | 預設 |
| --- | --- | --- |
| `duration` | 視窗長短 | 1 小時 |
| `maxRequest` | 視窗內允許次數 | 2500 |
| `id` | 按 API Key / 使用者；`false` 豁免 | IP |
| `allowList` / `denyList` | 內網跳過；封禁 IP | — |
| `store` | **多例項必換** Redis 等 | 記憶體 |

### 按 Key / 使用者，放過健康檢查

```typescript
rateLimit({
  maxRequest: 60,
  duration: 60_000,
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

### 只限單條路由

```typescript
import { body } from '@aomex/web';
import { rule } from '@aomex/common';

router.post('/login', {
  mount: [
    rateLimit({ maxRequest: 10, duration: 60_000 }), // [!code highlight]
    body({ email: rule.email(), password: rule.string() }),
  ],
  action: async (ctx) => {
    /* ... */
  },
});
```

### 生產多副本：Redis

構造時只傳 `RedisOptions`（`host` / `port` 等；型別可從本包引入），不要傳入已建好的 `Redis` 例項。`ioredis` 已隨 `@aomex/rate-limit-redis-store` 裝好，不必再單獨加依賴。store 內部會 `lazyConnect`，由 `rateLimit()` 經 [`registerLifecycle`](/zh-TW/core/service#生命週期鉤子) 在程序側連上 / 斷開。

```typescript
import { RateLimitRedisStore } from '@aomex/rate-limit-redis-store';

rateLimit({
  store: new RateLimitRedisStore({ // [!code highlight]
    host: '127.0.0.1',
    port: 6379,
  }),
  maxRequest: 500,
  duration: 3_600_000,
  id: (ctx) => {
    const key = ctx.request.headers['x-api-key'];
    if (typeof key === 'string') {
      return key;
    }
    return ctx.request.ip;
  },
});
```

預設記憶體 store 也可從 `@aomex/rate-limit/memory` 顯式引入；關停時會清空程序內計數。

| 環境 | 建議 |
| --- | --- |
| 本地直連 | 可掛應用限流，限額松一點，避免刷介面把自己鎖死 |
| 生產有 Nginx | **優先** `limit_req` 等做 IP / 連線限流；應用層留給登入、簡訊、按 Key 的配額 |
| 生產多 Pod + 應用內計數 | **必須**共享 `store`（Redis）；別和閘道器用同一套過緊的 IP 限額疊到誤傷 |

自建儲存需實現包內 `RateLimitStore` 的原子 `getAndSet`；需要連庫 / 關連線時可覆蓋 `onInit` / `onDestroy`（`rateLimit()` 會自動登記）。簽名以型別定義為準。

只按 IP 限流時，NAT 後面整棟辦公樓共用一個鍵，容易誤傷；登入等介面更適合按使用者或 API Key。全站限額過緊時，熱點路由單獨 mount 更常見。

## 下一步

- 蜜罐 / 錯誤累計 / 封 IP：[濫用防護](/zh-TW/plugins/abuse)
- 真實 IP（限流鍵）：[應用入口](/zh-TW/web/) 裡 proxyIP
- 身份維度：[Auth](/zh-TW/plugins/auth)
- 錯誤形態：[錯誤格式](/zh-TW/web/errors)