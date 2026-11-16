---
outline: deep
---

# 安全報文 Helmet

給面向瀏覽器的響應加一組預設合理的 HTTP 安全頭（防點選劫持、MIME 嗅探等），降低常見前端風險。純 JSON API 可選；有 H5、管理後臺、文件站時常見做法是預設掛上，CSP 再按真實資源收緊。

基於上游 [helmet](https://github.com/helmetjs/helmet)，選項與其 HelmetOptions 一致，細節見 [helmet 文件](https://helmetjs.github.io/)。

```bash
pnpm add @aomex/helmet
```

## WebApp 預設整包

無參 `helmet()` 會加上游預設的一組瀏覽器安全頭；有 HTML、文件站、管理臺時常見做法是進 `WebApp.mount`，純 JSON API 可按需省略。

```typescript
import { helmet } from '@aomex/helmet';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    helmet(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

與 [CORS](/zh-TW/plugins/cors) 同用時，兩者都放在 routers 前即可；頭也可以在反代層加，應用內掛更順手做按環境切換。

返回普通 WebMiddleware，不改 ctx 業務欄位。瀏覽器開發者工具 → Network → 響應頭裡能看到 X-Content-Type-Options、X-Frame-Options 等（具體組合隨 helmet 預設與子配置而變）。

## CSP 與環境分支

| 能力 | 什麼時候用 | 經驗預設 |
| --- | --- | --- |
| 無參整包 | 生產 Web / 給瀏覽器用的 API | 常見防護開齊 |
| `contentSecurityPolicy` | 有前端頁面、防 XSS | 按 CDN/指令碼域名白名單寫 |
| `contentSecurityPolicy: false` | Swagger/ReDoc 內聯指令碼起不來 | 常僅開發或文件路由 |
| 按 `NODE_ENV` 分支 | 本地少摩擦、上線收緊 | 見下方 demo |

### 生產：收緊 CSP（示例骨架）

```typescript
helmet({
  contentSecurityPolicy: { // [!code highlight]
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
    },
  },
});
```

### 開發 vs 生產

```typescript
const security =
  process.env.NODE_ENV === 'production'
    ? helmet()
    : helmet({ contentSecurityPolicy: false }); // [!code highlight]

mount: [security, cors(), routers('./src/routers')];
```

| 環境 | 建議 |
| --- | --- |
| 生產（有管理端 / H5） | 開啟，CSP 對照前端資源清單 |
| 生產（僅 JSON、無 HTML） | 可選；閘道器已統一加頭時可省略 |
| 本地 | 文件站 / Swagger 可 `contentSecurityPolicy: false` |

CSP 從嚴抄模板卻忘放行 CDN / 指令碼域名時，頁面白屏、控制台一堆 CSP 報錯。生產為省事關 CSP 會放大內聯指令碼面，和上線收緊目標相反。Helmet **不替** [CORS](/zh-TW/plugins/cors)，跨域仍要單獨配。

## 下一步

- 跨域：[CORS](/zh-TW/plugins/cors)
- 公開 API 文件 UI：[Swagger UI](/zh-TW/plugins/swagger-ui)、[Redoc UI](/zh-TW/plugins/redoc-ui)
- 中介軟體掛載位置：[中介軟體](/zh-TW/core/middleware)