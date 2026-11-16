---
outline: deep
---

# 跨域 CORS

讓瀏覽器裡的前端頁面能合法請求你的 API：開發時前後端分埠要過預檢；生產時要收緊「允許哪幾個 origin」，需要 Cookie 時還要配上 credentials。

```bash
pnpm add @aomex/cors
```

## 掛在 routers 之前

`cors()` 在中介軟體階段寫 Access-Control-* 響應頭，讓瀏覽器允許跨源讀響應體。必須掛在 `routers` **之前**，全站響應（含 4xx/5xx）才會帶頭，否則預檢過了、業務報錯時前端卻讀不到錯誤體。

```typescript
import { cors } from '@aomex/cors';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    cors(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

::: warning
CORS 掛在 routers **後面** 時，404 和校驗 400 可能缺頭，瀏覽器報「跨域」會把真因蓋住。
:::

本地前後端不同埠時，無參 cors() 一般會反射請求頭裡的 Origin，夠用。上線請改成明示域名。

cors() 返回普通 WebMiddleware，不往 ctx 上掛新欄位；業務 action 裡照常寫，跨域由響應頭解決。瀏覽器裡成功時能看到 Access-Control-Allow-Origin；帶 Cookie 的場景還要 Access-Control-Allow-Credentials: true，且 **不能** 用 origin: '*'。

## 收緊 Origin 與憑據

| 選項 | 什麼時候用 | 預設 |
| --- | --- | --- |
| `origin` | 生產固定前端域名，或多套前端用函式對照白名單 | 反射請求 `Origin` |
| `credentials` | 跨域要帶 Cookie / 鑑權頭 | — |
| `allowHeaders` | 前端要帶 `Authorization` 等自定義頭 | — |
| `exposeHeaders` | 前端要讀 `X-Request-Id` 等響應頭 | — |
| `maxAge` | 減少重複 OPTIONS；除錯可 `-1` 不快取 | `3600` |
| `allowMethods` | 只開放 GET/POST 時收緊 | 常見動詞全集 |
| `secureContext` / `privateNetworkAccess` | 隔離頁面、公網頁訪問內網 API（Chrome PNA） | `false` |

### 生產：Cookie + 單站前端

```typescript
cors({
  origin: 'https://app.example.com', // [!code highlight]
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-Request-Id'],
});
```

::: warning
credentials: true 時 **不能** 用 origin: '*'：瀏覽器會直接拒絕。
:::

### 生產：多套前端白名單

```typescript
const allowlist = new Set([
  'https://app.example.com',
  'https://admin.example.com',
]);

cors({
  origin: (ctx) => { // [!code highlight]
    const origin = ctx.request.headers['origin'];
    if (origin && allowlist.has(origin)) {
      return origin;
    }
    return false;
  },
  credentials: true,
});
```

| 環境 | 建議 |
| --- | --- |
| 本地 | 無參 `cors()` 或白名單里加 `http://localhost:5173` |
| 生產 | 禁止反射任意 `Origin`；`credentials` 時 origin 必須具體域名 |

生產仍用預設反射等於對任意站點敞開介面，疊 Cookie 更危險。只改 Web API、忘了文件站 / Swagger / 管理端的 origin 時，預檢會在這些域名上失敗。

## 下一步

- 掛載順序與洋蔥模型：[中介軟體](/zh-TW/core/middleware)
- 安全響應頭（常與 CORS 同排）：[Helmet](/zh-TW/plugins/helmet)
- 全站觀測：[HTTP 訪問日誌](/zh-TW/plugins/http-access-log)