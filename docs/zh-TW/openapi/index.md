---
outline: deep
---

# 生成OpenAPI

在路由上**宣告契約**，再掃成 OpenAPI 3.0：記憶體裡給指令碼 / Swagger 用，或經 Console **落盤**成檔案給 CI、SDK。生成鏈路在 `@aomex/openapi-generator`；Swagger / Redoc 只是讀這份 JSON 的方式。

沒掛 query / body / response 的路由，文件裡對應段也會空——執行時照樣能跑，只是契約不完整。send / throw 的型別收窄見 [約束響應](/zh-TW/web/response)。

```bash
pnpm add @aomex/openapi-generator
```

**傳入與線上同一份 `WebApp` 實例**（`app`），生成器會讀它的全域性 `mount` 和 `envelope`，security、錯誤體、套殼才不容易和真環境漂開。

## 路由上掛 response 與 docs

契約來自路由上的宣告：`query` / `body` / `params` 決定入參 schema，`response()` 寫各狀態碼出口，`docs` 寫 summary 與 tags。執行時校驗與型別收窄和文件同源；漏掛的段在 openapi.json 裡也會空著。

分組怎麼打、預設檔名 tag 怎麼覆蓋見 [Tags 分組](/zh-TW/openapi/tags)；`info.description` / 路由長說明裡的 Markdown 見 [Markdown 文案](/zh-TW/openapi/markdown)。

```typescript
// src/routers/user.ts
import { rule } from '@aomex/common';
import { query, response, Router } from '@aomex/web';

export const router = new Router({
  prefix: '/users',
  docs: { tags: ['User'] },
});

router.get('/', {
  docs: { summary: '用户列表' },
  mount: [query({ page: rule.int().min(1).default(1) })],
  action: async (ctx) => {
    ctx.send([]);
  },
});

router.get('/:id', { // [!code focus:14]
  docs: { summary: '用户详情' },
  mount: [
    response({ // [!code highlight]
      statusCode: 200,
      description: '找到用户',
      content: { id: rule.int(), name: rule.string() },
    }),
    response({ statusCode: 404, description: '不存在' }),
  ],
  action: async (ctx) => {
    // …
  },
});
```

## 傳入 app 生成 Document

`generateOpenapi` 要的是 **`WebApp` 實例**，不再單獨傳一份 `mount` 陣列。從 `app` 上讀取全域性中介軟體和 [響應體套殼](/zh-TW/web/envelope)，作為 OpenAPI 注入的單一真源。

CLI、測試、指令碼會 `import` 這份模組時，請把 `new WebApp(...)` 與 `app.listen(...)` **拆開**（或只在真正的程序入口 listen），否則一 import 就副作用起服、搶埠。

```typescript
// src/app.ts —— 只创建并导出，不 listen
import { formatError, routers, WebApp } from '@aomex/web';
import { rule } from '@aomex/common';
import { services } from '@/services';
import { logger } from '@/services/logger.service';

export const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:12]
    formatError({
      content: { code: rule.string(), message: rule.string() },
      handler(err) {
        return {
          code: err.code ?? 'ERROR',
          message: err.message,
        };
      },
    }),
    routers('./src/routers'),
  ],
});
```

```typescript
// src/main.ts —— 进程入口才听端口
import { app } from '@/app';

app.listen(3000);
```

```typescript
import { writeFile } from 'node:fs/promises';
import { generateOpenapi } from '@aomex/openapi-generator';
import { app } from '@/app';

const document = await generateOpenapi({ // [!code focus:11]
  routers: './src/routers',
  app, // [!code highlight]
  docs: {
    info: { title: 'My API', version: '1.0.0' },
  },
  fix: (doc) => {
    doc.servers = [{ url: 'https://api.example.com' }];
    return;
  },
});

await writeFile('openapi.json', JSON.stringify(document, null, 2));
```

- 路由上掛 body / query / params 後，ctx.body、ctx.query 等在 action 裡已是收窄後的型別——和文件 schema 同源。
- 掛 `response({ statusCode, content })` 後，`ctx.send(200, …)` 的第二個引數要對上 content；聲明瞭 200 卻 send(201) 通常會型別報錯。
- 只用手寫 `openapi.onMethod` 補某條響應時，**一般隻影響生成的 JSON**，不會自動收窄 ctx.send——那種場景要自己盯型別。

`response()` 常用欄位：

| 欄位 | 什麼時候用 |
| --- | --- |
| `statusCode` | 每個出口掛一次（200 / 201 / 204 / 404…） |
| `content` | JSON 成功體；順帶收窄 `ctx.send` |
| `contentType` | CSV、HTML、二進位制等非預設 JSON |
| `headers` | 要文件化 `X-Request-Id` 等 |
| `example` | 文件站示例，不影響執行時 |

非 JSON 示例：

```typescript
response({
  statusCode: 200,
  contentType: 'text/csv', // [!code highlight]
  content: rule.string(),
  description: '导出 CSV',
});
```

驗證器套不上的少數響應（二進位制流等），可在該路由掛帶 `openapi.onMethod` 的中介軟體，只改生成結果：

```typescript
import { middleware } from '@aomex/common';

export const openapiBinaryFile = middleware.web({ // [!code focus:18]
  fn: async (_ctx, next) => {
    return next();
  },
  openapi: {
    onMethod(methodItem) { // [!code highlight]
      methodItem.responses ||= {};
      methodItem.responses['200'] = {
        description: '文件流',
        content: {
          'application/octet-stream': {
            schema: { type: 'string', format: 'binary' },
          },
        },
      };
    },
  },
});
```

## generateOpenapi 選項與執行時出口

`generateOpenapi` 讀路由目錄，並從 `app` 取出全域性 `mount` / `envelope`，在記憶體裡拼出 OpenAPI Document；可寫檔案、掛進 Swagger/ReDoc，或給 CI diff。它**不啟動 HTTP**，也不會自動收窄執行時 ctx——收窄仍靠路由上的 mount。

| `generateOpenapi` 選項 | 什麼時候用 |
| --- | --- |
| `routers` | 必填；與 Web 掃路由同一 glob |
| `app` | 與線上同一 `WebApp` 實例（帶出 mount、envelope） |
| `docs` | `info.title` / `version` / `description` |
| `fix` | 補 `servers`、聯絡人、廠商擴充套件；單條響應優先在路由上 `response()` |

執行時動態吐規範（自建 `/openapi.json`）：

```typescript
import { app } from '@/app';

router.get('/openapi.json', {
  docs: { showInOpenapi: false },
  action: async (ctx) => {
    const document = await generateOpenapi({ // [!code highlight]
      routers: './src/routers',
      app,
    });
    ctx.send(document);
  },
});
```

每次請求都掃路由——訪問頻繁時可加快取，或改下面的 Console 落盤 + 靜態檔案。

::: warning
`generateOpenapi` 的 `app` **必填**（型別上也是），並應與線上是**同一份配置**（同一實例最省事）。漏傳過不了編譯；傳了另一套 mount / envelope 時，文件裡的鑑權、formatError、套殼仍會和真環境對不上。
:::

## Console 落盤：`openapi()` + `aomex openapi`

不改 HTTP 程序、只要把契約**寫成檔案**時，在 `ConsoleApp` 的 mount 裡掛 `openapi({ routers, app, saveToFile, … })`，再執行 `aomex openapi`。底層仍走同一套生成邏輯，只是批處理寫盤。

```typescript
// src/cli.ts
import { openapi } from '@aomex/openapi-generator';
import { commanders, ConsoleApp } from '@aomex/console';
import { app } from '@/app';
import { services } from '@/services';
import { logger } from '@/services/logger.service';

new ConsoleApp({
  services,
  logger,
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

成功後當前工作目錄（或你配置的路徑）會出現契約檔案。`routers` / `app` / `docs` / `fix` 含義與 `generateOpenapi` 相同；多出來的是 `saveToFile`（預設 `openapi.json`）。

::: tip
Console 落盤、指令碼生成都會 `import` 你的 Web 模組：`new WebApp` 與 `app.listen` 拆開，避免 CLI 一跑就起 HTTP。
:::

::: warning
`saveToFile` 路徑要和 CI 產物目錄對齊，否則流水線找不到檔案、下游 SDK 仍用舊契約。改路由或改 `app` 的 mount / envelope 後記得跑 `aomex openapi`，別讓倉庫裡的契約檔案漂著。
:::

CI 歸檔示例：

```typescript
openapi({
  routers: './src/routers',
  app,
  saveToFile: 'artifacts/openapi.json', // [!code highlight]
  docs: {
    info: { title: 'My API', version: '1.0.0' },
  },
});
```

| 場景 | 做法 |
| --- | --- |
| CI 每次構建歸檔契約 | `openapi()` + `aomex openapi` |
| 改完路由本地更新檔案 | 同上，手動跑一遍 |
| 執行時按請求吐最新 JSON | Web 路由調 `generateOpenapi({ routers, app })` |
| 開發期點開試調 | 先看 [怎麼選文件 UI](/zh-TW/openapi/choose-ui)，再掛 [Swagger](/zh-TW/openapi/swagger-ui) / [Redoc](/zh-TW/openapi/redoc-ui) / [Scalar](/zh-TW/openapi/scalar-ui) 讀落盤或動態 `generateOpenapi` |

落盤和執行時動態吐 `/openapi.json` 不是一回事：高頻線上掃描費 CPU，生產文件站多數用落盤 + 靜態或 UI 外掛讀檔案。

能掛在路由上的 response 儘量用 `response()` 維護，別隻靠 fix 手改每一條。忘記 `docs.summary` / tags 時生成仍能用，對接方翻文件會痛苦——分組與文案分別見 [Tags](/zh-TW/openapi/tags) · [Markdown](/zh-TW/openapi/markdown)。提供 JSON 的那條路由通常設 `docs.showInOpenapi: false`，避免遞迴描述自己。

## 相關

- [Tags 分組](/zh-TW/openapi/tags)
- [Markdown 文案](/zh-TW/openapi/markdown)
- [約束響應](/zh-TW/web/response)
- [響應體套殼](/zh-TW/web/envelope)（傳 `app` 時自動把成敗支收成 200；`skipEnvelope` 的狀態碼原樣保留）
- [錯誤格式](/zh-TW/web/errors)
- [怎麼選文件 UI](/zh-TW/openapi/choose-ui) · [Swagger UI](/zh-TW/openapi/swagger-ui) · [Redoc UI](/zh-TW/openapi/redoc-ui) · [Scalar UI](/zh-TW/openapi/scalar-ui)
