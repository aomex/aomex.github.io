---
outline: deep
---

# Web 應用入口

把 HTTP 服務跑起來：[combineServices](/zh-TW/core/service) 備好 services 和 logger，`new WebApp` 填齊必填項，用 `routers('./src/routers')` 掛上路由。下面順帶說明整站語言、客戶端 IP、請求體上限，以及路由裡 ctx.send / ctx.throw / ctx.redirect 的用法。

```bash
pnpm add @aomex/web @aomex/common @aomex/logger
pnpm add tsx -D
```

業務服務用 [combineServices](/zh-TW/core/service) 註冊；WebApp 必須拿到它的返回值，以及對應的 logger 例項。

```typescript
// src/services/index.ts
import { combineServices } from '@aomex/common';

export const services = await combineServices(
  { logger: () => import('./logger.service.js') },
  { eager: ['logger'] }, // [!code highlight]
);
```

```typescript
// src/web.ts
import { routers, WebApp } from '@aomex/web';
import { services } from './services/index.js';

const app = new WebApp({ // [!code focus:7]
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [routers('./src/routers')], // [!code highlight]
});

app.listen(3000, () => {
  console.log('HTTP 服务已启动');
});

declare module '@aomex/web' {
  namespace WebApp {
    type T = WebApp.Infer<typeof app>;
    interface Props extends T {}
  }
}
```

`new WebApp({ ... })` 裡漏掉 services、logger、language、proxyIP 任一必填項，編譯器會直接報錯。全域性 mount 裡用 `middleware.web` 往 ctx 掛了欄位，卻不上面的 `declare module` 時，執行時有值、型別裡沒有，業務裡容易到處 as。路由若掛了 [response()](/zh-TW/web/response)，ctx.send / ctx.throw 的 body 形狀會跟著宣告收窄。

::: warning
全域性 mount 往 ctx 掛了欄位卻沒寫 `declare module` 時，執行時有值、型別裡沒有，業務裡容易到處 as。
:::

```bash
node --import tsx/esm --watch src/web.ts
```

瀏覽器開啟 [http://localhost:3000](http://localhost:3000) 即可。建議把啟動命令寫進 package.json 的 scripts，團隊統一用 pnpm start。

下面欄位都在 `new WebApp({ ... })` 裡動。路由只管「這條路徑做什麼」；這些是「整站怎麼跑」。

## services 與 logger

`services` 是業務服務容器（查庫、快取、發信等都掛在這裡），用 [combineServices](/zh-TW/core/service) 組裝後交給 WebApp。程序關停時，框架會在銷燬階段對已載入的服務調 `destroy`，用來關連線、刷日誌。

`logger` 必須單獨再傳一份（通常就是 `services.logger`）：路由和中介軟體裡的 `ctx.logger` 用的就是這個例項，和構造引數是同一引用。

```typescript
const app = new WebApp({
  services, // [!code highlight]
  logger: services.logger, // [!code highlight]
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

## language

決定 **body() / query() 校驗失敗、框架內建提示**用哪種語言。語言碼用 `zh-CN`、`en-US`（連字元；別寫 `zh_CN`）。管的是框架側文案，不是前端 Ant Design / Day.js 的 locale，也不是業務詞條——業務多語言見 [高階：業務國際化](/zh-TW/advanced/i18n)。

| 模式 | 什麼時候用 |
| --- | --- |
| `fixed` + `language` | 內網後臺、單語種 SaaS，不必讀請求頭 |
| `dynamic` | 公開多端 API，按請求協商 |
| `header: 'accept-language'` | 瀏覽器、標準客戶端（按 RFC `q` 排序） |
| `header: 'x-language'` | App 自定義頭（逗號分隔，一般忽略 `q`） |
| `fallback` | 頭缺失或都不認識時的兜底 |

固定語言：

```typescript
language: { mode: 'fixed', language: 'zh-CN' },
```

按 Accept-Language 協商：

```typescript
language: {
  mode: 'dynamic', // [!code highlight]
  header: 'accept-language',
  fallback: 'zh-CN',
},
```

自定義頭：

```typescript
language: {
  mode: 'dynamic',
  header: 'x-language', // [!code highlight]
  fallback: 'zh-CN',
},
```

自測：

```bash
curl -H 'Accept-Language: en-US' http://localhost:3000/users
```

::: warning
別在很晚的中介軟體裡才設語言——前面的 body() / query() 可能已經按預設語報過錯了；交給 WebApp.language 才能罩住框架文案。Console 側只能寫死字串，見 [Console 應用入口](/zh-TW/console/#language)。
:::

## proxyIP

填充 `ctx.request.ip`。配錯等於限流和風控看錯人。

| 模式 | 什麼時候用 |
| --- | --- |
| `detect` | 本機 `tsx`、單測；前面有沒有反代不確定，先能跑通 |
| `specify` | 公網生產：只信自家反代寫的頭，防客戶端偽造 `X-Forwarded-For` |

```typescript
proxyIP: { mode: 'detect' },
```

::: warning
公網生產別長期用 detect：客戶端能偽造常見代理頭，限流和審計會認錯人。上線應改 specify 並只信自家反代寫的頭。
:::

```typescript
proxyIP: {
  mode: 'specify', // [!code highlight]
  header: 'x-forwarded-for',
  hops: 1,
},
```

hops 要和真實代理層數一致，否則讀到上一跳內網地址或 CDN 節點，登入異地提醒等風控都會歪。

| 拓撲 | 常見做法是這樣配 |
| --- | --- |
| Node 直連公網 / 開發機直連 | `detect` 或 `specify` 且不讀代理頭 |
| 單層 Nginx → Node | `specify` + `x-forwarded-for`，`hops: 1` |
| CDN + 自家 Nginx | `x-forwarded-for`，`hops: 2`（按實際層數改） |
| 流量只經 Cloudflare | `specify` + `cf-connecting-ip`，`hops: 1` |

```typescript
proxyIP: {
  mode: 'specify',
  header: 'cf-connecting-ip', // [!code highlight]
  hops: 1,
},
```

## mount

`mount` 是整站中介軟體佇列：每個請求都會按陣列順序走進來（洋蔥模型，可在 `await next()` 前後做事）。跨域、全站鑑權、訪問日誌、以及 `routers('./src/routers')` 掃出來的介面，都掛在這裡。

隻影響某一組 URL 的邏輯，請放到 [Router](/zh-TW/web/router) 或單條路由的 mount，別全塞進 WebApp。

```typescript
import { middleware } from '@aomex/common';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:9]
    middleware.web(async (ctx, next) => { // [!code highlight]
      const start = Date.now();
      await next();
      const cost = Date.now() - start;
      const { method, url } = ctx.request;
      await ctx.logger.info(`${method} ${url} ${cost}ms`);
    }),
    routers('./src/routers'),
  ],
});
```

## shutdown

程序收到 `SIGTERM` / `SIGINT`（例如 `docker stop`、Ctrl+C、K8s 滾動釋出）時，WebApp 會做**優雅關停**：先停止接受新連線，等在途請求儘量跑完，再銷燬 services，最後以退出碼 0 結束程序。

`timeout` 是最長等待時間（預設約 **5 秒**，可寫毫秒數或 `'10s'` 這類時長字串）。到期還有連線時，會強制斷開，避免程序卡死拖垮釋出。

```typescript
shutdown: { timeout: 10_000 },
```

本地開發很少改；生產若有上傳、長輪詢、慢查詢，可按最壞請求耗時調大。關停期間新請求進不來——負載均衡應先摘掉例項再發訊號。

## body 全站配額

上傳介面或開放大 JSON 的 webhook 前，先看預設夠不夠；不夠就在應用級收緊或放寬。

| 型別 | 典型 Content-Type | 預設（可參考） |
| --- | --- | --- |
| `payload` | JSON、urlencoded、text 等整包進記憶體 | 約 `2mb`，超限 **413** |
| `formData` | `multipart/form-data` | 單檔案約 `50mb`、檔案數 / 欄位數有上限 |

```typescript
const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  body: { // [!code focus:8]
    payload: { maxSize: '1mb' }, // [!code highlight]
    formData: {
      maxFileSize: '20mb',
      maxFiles: 5,
      maxFields: 50,
    },
  },
  mount: [routers('./src/routers')],
});
```

路由上的 [body()](/zh-TW/web/body) 若聲明瞭檔案欄位，會與應用級 formData 上限**取更嚴**的一方。上傳細節見 [檔案上傳](/zh-TW/web/attach)。

開放 webhook 或大 JSON 前先看預設配額：整包先進記憶體，超限是 **413**，和校驗失敗的 **400** 不是一回事；只改路由、不改應用級 body.payload 往往不夠。

## envelope

需要**成功和失敗共用同一種 JSON 外殼**、外層 HTTP 固定 **200**（真實狀態碼寫在 body 裡）時，在 `new WebApp` 上配 `envelope`。路由裡仍照常 `send` / `throw`，框架在寫出前套殼。

宣告樹用 `envelope.success` / `envelope.payload` / `envelope.statusCode` 和可選的 `envelope.slot` 拼裝；常與 [formatError](/zh-TW/web/errors) 一起用。細節、跳過規則（重定向、204、SSE 等）見 [響應體套殼](/zh-TW/web/envelope)。

## listen、http、https

`listen` 真正把 HTTP 服務綁到埠上；不呼叫它，程序裡只有 App 物件，外面訪問不到。`app.listen(port)` 等價於 `app.http({}).listen(port)`，走明文 HTTP。

```typescript
app.http({ keepAliveTimeout: 65_000 }).listen(3000);
```

```typescript
import fs from 'node:fs';
import path from 'node:path';

app
  .https({
    key: fs.readFileSync(path.resolve('ca', 'cert.key')),
    cert: fs.readFileSync(path.resolve('ca', 'cert.pem')),
  }) // [!code highlight]
  .listen(443);
```

生產更常見的是 Nginx / Caddy 終結 TLS，反代到 Node HTTP——同時要配準 proxyIP。

## ctx.send

在路由 action 或全域性中介軟體裡，省略狀態碼預設 **200**；201、204 等要顯式寫第一位引數。

```typescript
router.get('/ping', {
  action: async (ctx) => {
    ctx.send('plain text'); // [!code highlight]
  },
});
```

```typescript
router.post('/users', {
  action: async (ctx) => {
    const user = await createUser(ctx.body);
    ctx.send(201, { id: user.id }); // [!code highlight]
  },
});
```

```typescript
router.delete('/sessions/current', {
  action: async (ctx) => {
    await revokeSession(ctx);
    ctx.send(204); // [!code highlight]
  },
});
```

## ctx.throw

只用 **4xx / 5xx**。業務拒絕走 ctx.throw，別 throw new Error——公開的 4xx 不會當 5xx 刷髒日誌。

```typescript
router.get('/users/:id', { // [!code focus:12]
  mount: [params({ id: rule.int().min(1) })],
  action: async (ctx) => {
    const user = await findUser(ctx.params.id);
    if (!user) {
      ctx.throw(404); // [!code highlight]
    }
    if (!canView(ctx, user)) {
      ctx.throw(403, { code: 'FORBIDDEN' });
    }
    ctx.send(user);
  },
});
```

```typescript
ctx.throw(500, 'payment gateway timeout', { expose: true });
```

`expose: true` 時響應體會展示 message——別把 SQL、內部路徑寫進去。

## ctx.redirect

永久 **301**，臨時常用 **302**（省略狀態碼時預設 302）。

```typescript
router.get('/old-profile', {
  action: async (ctx) => {
    ctx.redirect(301, '/profile'); // [!code highlight]
  },
});
```

```typescript
router.get('/login-done', {
  action: async (ctx) => {
    ctx.redirect('/dashboard'); // [!code highlight]
  },
});
```

## download、sse、logger

路由裡還會用到這幾個出口，專頁寫細，這裡先認個臉：

- `ctx.download`：把檔案流寫給客戶端；流結束後 Promise 才會 settled，適合「下完就刪」的臨時檔案。
- `ctx.sse()`：服務端推送（Server-Sent Events），見 [SSE](/zh-TW/web/sse)。
- `ctx.logger`：就是構造 WebApp 時傳入的那個 logger；要給每條日誌帶 `requestId` 等，見 [日誌 · withBindings](/zh-TW/core/logger#請求級上下文withbindings)。

### app.on('error')

action / 中介軟體裡沒接住的異常，框架會 `emit('error', err, ctx)`。預設已按 `expose` 決定要不要打 `logger.error`；你再監聽這個事件，適合接 Sentry、釘釘等旁路通知。

**別在這裡改響應體**——時機往往已經晚了，容易和已寫出的響應打架。全站統一的 JSON 錯誤形狀用 [formatError](/zh-TW/web/errors)；成功失敗都要同一層外殼、外層固定 200 時用 [響應體套殼](/zh-TW/web/envelope)。

## 下一步

- [介面路由](/zh-TW/web/router)：按檔案拆 URL 與 HTTP 動詞
- [query](/zh-TW/web/query) / [params](/zh-TW/web/params) / [body](/zh-TW/web/body)：入參校驗三件套
- [約束響應](/zh-TW/web/response)：讓 TypeScript 與 OpenAPI 說同一種話
- [服務端推送 SSE](/zh-TW/web/sse)：ctx.sse / stream / 斷線續傳
- [錯誤格式](/zh-TW/web/errors)：`ctx.throw` 後的 JSON 錯誤體
- [響應體套殼](/zh-TW/web/envelope)：統一 JSON 外殼、外層 HTTP 200