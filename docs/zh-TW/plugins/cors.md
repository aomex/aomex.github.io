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

本地前後端不同埠、**又不帶 Cookie** 時，無參 `cors()` 會反射請求頭裡的 Origin，一般夠用。一旦要跨域帶 Cookie（[Session](/zh-TW/plugins/auth-session-strategy)），就必須顯式寫 origin，見下一節。

cors() 返回普通 WebMiddleware，不往 ctx 上掛新欄位；業務 action 裡照常寫，跨域由響應頭解決。瀏覽器裡成功時能看到 Access-Control-Allow-Origin；帶 Cookie 的場景還要 Access-Control-Allow-Credentials: true，且 **不能** 用 origin: '*'。

## Cookie 登入：必須顯式 origin

`credentials: true`（或函式返回 `true`）時：

- **必須**顯式配置 `origin`（具體域名、白名單陣列、或返回具體來源的函式）
- **禁止**依賴無參 cors() 的預設反射——漏配會在建立或請求階段直接拋錯
- **禁止** `origin: '*'`（瀏覽器也不認這種組合）

前端還要帶 `Authorization`、`x-csrf-token` 時，用 `allowHeaders` 放行；要讓前端指令碼讀到 `X-Request-Id` 等自定義頭，用 `exposeHeaders`。

```typescript
cors({
  origin: 'https://app.example.com', // [!code highlight]
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
  exposeHeaders: ['X-Request-Id'],
});
```

::: warning
開了 credentials 卻不寫 origin，或寫成 `*`，應用起不來或一請求就拋錯——這是有意攔住「反射任意 Origin + Cookie」的危險預設。
:::

Session 還要掛 [CSRF](/zh-TW/plugins/csrf)，並讓前端 `fetch` 使用 `credentials: 'include'`。完整鏈路見 [Session 策略](/zh-TW/plugins/auth-session-strategy)。

## 多套前端白名單

App 與管理端分域名時，`origin` 可以直接給陣列；命中才回寫，未命中等於不啟用 CORS。

```typescript
const allowlist = [
  'https://app.example.com',
  'https://admin.example.com',
];

cors({
  origin: allowlist, // [!code highlight]
  credentials: true,
  allowHeaders: ['Content-Type', 'x-csrf-token'],
});
```

也可用函式按請求返回具體 origin（命中白名單才回寫；未命中返回 `undefined` 表示不啟用 CORS）：

```typescript
cors({
  origin: (ctx) => {
    const origin = ctx.request.headers['origin'];
    if (typeof origin === 'string' && allowlist.includes(origin)) {
      return origin;
    }
    return undefined;
  },
  credentials: true,
});
```

預檢快取預設約一小時（`maxAge: 3600`）；本地除錯可設 `-1` 讓每次 OPTIONS 都重新打。只開放 GET/POST 時再用 `allowMethods` 收緊。隔離頁面 / 公網頁訪問內網 API（Chrome PNA）才需要 `secureContext` / `privateNetworkAccess`。

| 環境 | 建議 |
| --- | --- |
| 本地（不帶 Cookie） | 無參 `cors()` |
| 本地（Session） | `origin: 'http://localhost:5173'` + `credentials: true` |
| 生產 | 明示域名或白名單；開憑證時絕不用預設反射 |

只改 Web API、忘了文件站 / Swagger / 管理端的 origin 時，預檢會在這些域名上失敗。

## 下一步

- Cookie 登入整條鏈：[Session 策略](/zh-TW/plugins/auth-session-strategy)
- 寫請求防偽造：[CSRF](/zh-TW/plugins/csrf)
- 掛載順序與洋蔥模型：[中介軟體](/zh-TW/core/middleware)
- 安全響應頭（常與 CORS 同排）：[Helmet](/zh-TW/plugins/helmet)
- 全站觀測：[HTTP 訪問日誌](/zh-TW/plugins/http-access-log)
