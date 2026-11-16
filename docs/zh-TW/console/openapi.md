---
outline: deep
---

# OpenAPI 落盤

在 **不改 HTTP 程序** 的前提下，用一條 Console 指令把路由掃成的契約**寫成檔案**，給 CI、SDK 或文件站用。路由怎麼宣告、`generateOpenapi` 怎麼用，見 Web 側 [OpenAPI 生成](/zh-TW/plugins/openapi)。

```bash
pnpm add @aomex/openapi
```

在 `ConsoleApp` 的 mount 裡掛上 `openapi({ routers, app, saveToFile, … })`，本地或流水線執行 `aomex openapi`，得到 `openapi.json`（或你指定的路徑）。`app` 傳與線上同一份 `WebApp`，全域性中介軟體和 [envelope](/zh-TW/web/envelope) 會一起進契約。

傳入 `app` 時，請把 `new WebApp(...)` 與 `app.listen(...)` **拆開**（或只在入口 listen），否則 Console `import` Web 模組會副作用起服。

```typescript
// src/app.ts —— 只导出 WebApp，不 listen
import { formatError, routers, WebApp } from '@aomex/web';
import { services } from './services/index.js';

export const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [formatError({ /* … */ }), routers('./src/routers')],
});
```

```typescript
// src/cli.ts
import { openapi } from '@aomex/openapi';
import { commanders, ConsoleApp } from '@aomex/console';
import { app } from './app.js';

new ConsoleApp({
  services,
  logger: services.logger,
  language: 'zh-CN',
  mount: [
    openapi({ // [!code focus:18]
      routers: './src/routers',
      app, // [!code highlight]
      saveToFile: 'openapi.json',
      docs: {
        info: {
          title: 'My API',
          version: '1.0.0',
        },
      },
      fix: (doc) => {
        doc.servers = [{ url: 'https://api.example.com' }];
        return;
      },
    }),
    commanders('./src/commanders'),
  ],
});
```

```bash
npx aomex openapi
# 脚手架里常见：pnpm aomex openapi
```

成功後當前工作目錄（或你配置的路徑）會出現契約檔案。

Console 這條鏈路主要是**批處理寫檔案**，不像 Web 路由那樣收窄 ctx。業務路由上的 body / response 照舊在編譯期收窄 action；落盤指令只是讀同一套路由定義 + `app` 上的全域性配置去生成 JSON。

::: warning
`saveToFile` 路徑要和 CI 產物目錄對齊，否則流水線找不到檔案、下游 SDK 仍用舊契約。改路由或改 `app` 的 mount / envelope 後記得跑 `aomex openapi`，別讓倉庫裡的契約檔案漂著。
:::

## routers 與 app

落盤指令不會真的起 HTTP，但生成契約時要讀**和線上一致**的路由目錄，以及同一份 `WebApp`（鑑權、formatError、envelope 都從它來）。`routers` 指向與 Web 相同的 glob；漏傳 `app` 時，文件裡的 security、錯誤體、套殼形狀容易和真實響應不一致。

| 選項 | 什麼時候用 | 預設 |
| --- | --- | --- |
| `routers` | 必填；與 Web 掃路由同一 glob | — |
| `app` | 與線上同一 `WebApp` 例項 | — |
| `docs` | `info.title` / `version` / `description` | — |
| `fix` | 補 `servers`、聯絡人等文件級欄位 | — |
| `saveToFile` | 落盤路徑；CI 歸檔 | `openapi.json` |

CI 歸檔示例：

```typescript
import { app } from './app.js';

openapi({
  routers: './src/routers',
  app,
  saveToFile: 'artifacts/openapi.json', // [!code highlight]
  docs: {
    info: { title: 'My API', version: '1.0.0' },
  },
  fix: (doc) => {
    doc.servers = [{ url: 'https://api.example.com' }];
    return;
  },
});
```

## 落盤 vs 執行時吐 JSON

| 場景 | 做法 |
| --- | --- |
| CI 每次構建歸檔契約 | 本頁：`openapi()` + `aomex openapi` |
| 改完路由本地更新檔案 | 同上，手動跑一遍 |
| 執行時按請求吐最新 JSON | Web 路由調 `generateOpenapi({ routers, app })`，不必走 Console |

生成好的檔案交給 [Swagger UI](/zh-TW/plugins/swagger-ui) / [Redoc UI](/zh-TW/plugins/redoc-ui)，或提交倉庫做契約測試。

落盤和執行時動態吐 `/openapi.json` 不是一回事：高頻線上掃描費 CPU，生產文件站多數用落盤 + 靜態或 UI 外掛讀檔案。

## 相關

- [OpenAPI 生成](/zh-TW/plugins/openapi)
- [響應體套殼](/zh-TW/web/envelope)
- [Swagger UI](/zh-TW/plugins/swagger-ui)
- [Redoc UI](/zh-TW/plugins/redoc-ui)
