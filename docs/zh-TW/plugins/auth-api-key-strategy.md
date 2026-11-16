---
outline: deep
---

# API Key 策略

給指令碼、合作方或內部服務一條「帶鑰匙就能調」的通道。AuthApiKeyStrategy 從報頭（或你配置的 query/cookie）讀**裸**金鑰，對映成應用身份——**不是** Bearer 那種兩段式。終端使用者登入請用 [Bearer](/zh-TW/plugins/auth-bearer-strategy) 或 [JWT](/zh-TW/plugins/auth-jwt-strategy)。

校驗 x-api-key（或自定義頭），通過後業務裡用 ctx.auth.apiKey；開放平臺可以和使用者登入域拆成兩個 Router 字首。

## 安裝

與 Bearer 共用 `@aomex/auth` 主包。

```bash
pnpm add @aomex/auth
```

```typescript
import { AuthApiKeyStrategy } from '@aomex/auth/api-key';
```

## 開放平臺 Router

```typescript
import { Auth } from '@aomex/auth';
import { AuthApiKeyStrategy } from '@aomex/auth/api-key';
import { Router } from '@aomex/web';

const auth = new Auth({
  strategies: {
    apiKey: new AuthApiKeyStrategy({
      onLoaded: async (key) => {
        const app = await clients.verify(key);
        if (!app) {
          return false;
        }
        return { appId: app.id, scopes: app.scopes };
      },
    }),
  },
});

const openApi = new Router({
  prefix: '/open',
  mount: [auth.authenticate('apiKey')], // [!code highlight]
});

openApi.get('/usage', {
  action: async (ctx) => {
    ctx.send({ appId: ctx.auth.apiKey.data.appId });
  },
});
```

需要和使用者 Bearer 並存時，策略名各管各的，掛載在不同 Router 上即可。

成功後：

```typescript
ctx.auth.apiKey // { key: string; data: T }
```

authorize('apiKey', …) 的額外引數型別，與 Bearer 一樣，來自你寫的 onAuthorize。沒寫 onAuthorize 時，一般只做「有沒有合法 key」這一層。

## keyLoaders 與限流維度

| 選項 | 什麼時候用 | 預設 |
| --- | --- | --- |
| `keyLoaders` | 按序嘗試 header / query / cookie | `[{ type: 'header', key: 'x-api-key' }]` |
| `onLoaded` | 校驗 key 並返回應用身份 | **必填** |
| `onAuthorize` | 按 scope、套餐等再卡一層 | 可選 |

支援的 loader：

- header — 報頭裸值（key 名會轉小寫匹配）
- query — 慎用，易進日誌
- cookie — 按團隊約定

**不支援從 body 讀 Key**，避免金鑰落進請求體日誌。query 裡的 key 會進訪問日誌，生產優先 header。

多來源回退示例：

```typescript
new AuthApiKeyStrategy({
  keyLoaders: [ // [!code highlight]
    { type: 'header', key: 'x-api-key' },
    { type: 'query', key: 'api_key' },
  ],
  onLoaded: async (key) => {
    return lookup(key);
  },
});
```

signature() 可用來生成隨機 Key 串（簽發新客戶端時），用法與 Bearer 策略類似。

和 [@aomex/rate-limit](/zh-TW/plugins/rate-limit) 搭配時，可按 key 做配額維度——通常要保證限流前已經完成認證，或你自己從 header 讀 key：

```typescript
rateLimit({
  id: (ctx) => { // [!code highlight]
    return ctx.auth.apiKey?.key ?? ctx.request.ip;
  },
});
```

OpenAPI 會注入 apiKey scheme，in / name 一般取自**第一個** keyLoader。

::: warning
金鑰洩露即許可權洩露：庫存雜湊、支援輪換，別明文長期躺在庫裡。API Key 不是 C 端使用者登入替代品，終端產品仍用 Bearer/JWT。
:::

別把使用者 session 和 API Key 混在同一路由組：開放平臺單獨 prefix + authenticate('apiKey') 更清晰。

## 相關

- [身份認證](/zh-TW/plugins/auth)
- [Bearer 策略](/zh-TW/plugins/auth-bearer-strategy)
- [限流](/zh-TW/plugins/rate-limit)