---
outline: deep
---

# OpenAPI 文件生成

在路由上**宣告契約**，再**掃一遍路由匯出 OpenAPI 3.0**，給對接方或 CI 用。Swagger / Redoc 只是「怎麼讀這份 JSON」——生成鏈路本身在 `@aomex/openapi`。Web 程序裡用 `generateOpenapi`；要落盤成檔案見 [Console 落盤](/zh-TW/console/openapi)。

沒掛 query / body / response 的路由，文件裡對應段也會空——執行時照樣能跑，只是契約不完整。send / throw 的型別收窄見 [約束響應](/zh-TW/web/response)。

```bash
pnpm add @aomex/openapi
```

在列表、詳情等路由上掛驗證器和 `response()`，再呼叫 `generateOpenapi`，得到可提交的 `openapi.json`（或記憶體裡的 Document）。**傳入與線上同一份 `WebApp` 例項**（`app`），生成器會讀它的全域性 `mount` 和 `envelope`，security、錯誤體、套殼才不容易和真環境漂開。

## 路由上掛 response 與 docs

契約來自路由上的宣告：`query` / `body` / `params` 決定入參 schema，`response()` 寫各狀態碼出口，`docs` 寫 summary 與 tags。執行時校驗與型別收窄和文件同源；漏掛的段在 openapi.json 裡也會空著。

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

`generateOpenapi` 要的是 **`WebApp` 例項**，不再單獨傳一份 `mount` 陣列。從 `app` 上讀取全域性中介軟體和 [響應體套殼](/zh-TW/web/envelope)，作為 OpenAPI 注入的單一真源。

CLI、測試、指令碼會 `import` 這份模組時，請把 `new WebApp(...)` 與 `app.listen(...)` **拆開**（或只在真正的程序入口 listen），否則一 import 就副作用起服、搶埠。

```typescript
// src/app.ts —— 只创建并导出，不 listen
import { formatError, routers, WebApp } from '@aomex/web';
import { rule } from '@aomex/common';
import { services } from './services/index.js';

export const app = new WebApp({
  services,
  logger: services.logger,
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
import { app } from './app.js';

app.listen(3000);
```

```typescript
import { writeFile } from 'node:fs/promises';
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

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
- 只用手寫 `openapi.onMethod` 補某條響應時，**一般只影響生成的 JSON**，不會自動收窄 ctx.send——那種場景要自己盯型別。

`response()` 常用欄位：

| 欄位 | 什麼時候用 |
| --- | --- |
| `statusCode` | 每個出口掛一次（200 / 201 / 204 / 404…） |
| `content` | JSON 成功體；順帶收窄 `ctx.send` |
| `contentType` | CSV、HTML、二進制等非預設 JSON |
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

驗證器套不上的少數響應（二進制流等），可在該路由掛帶 `openapi.onMethod` 的中介軟體，只改生成結果：

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

## generateOpenapi 與執行時出口

`generateOpenapi` 讀路由目錄，並從 `app` 取出全域性 `mount` / `envelope`，在記憶體裡拼出 OpenAPI Document；可寫檔案、掛進 Swagger/ReDoc，或給 CI diff。它**不啟動 HTTP**，也不會自動收窄執行時 ctx——收窄仍靠路由上的 mount。

| `generateOpenapi` 選項 | 什麼時候用 |
| --- | --- |
| `routers` | 必填；與 Web 掃路由同一 glob |
| `app` | 與線上同一 `WebApp` 例項（帶出 mount、envelope） |
| `docs` | `info.title` / `version` / `description` |
| `fix` | 補 `servers`、聯絡人、廠商擴充套件；單條響應優先在路由上 `response()` |

執行時動態吐規範（自建 `/openapi.json`）：

```typescript
import { app } from '../app.js';

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

每次請求都掃路由——訪問頻繁時可加快取，或改 CI 落盤 + 靜態檔案。

::: warning
`generateOpenapi` 的 `app` **必填**（型別上也是），並應與線上是**同一份配置**（同一例項最省事）。漏傳過不了編譯；傳了另一套 mount / envelope 時，文件裡的鑑權、formatError、套殼仍會和真環境對不上。
:::

::: tip
Console 落盤、指令碼生成都會 `import` 你的 Web 模組：`new WebApp` 與 `app.listen` 拆開，避免 CLI 一跑就起 HTTP。
:::

CI / 本地**固定落盤**用 Console：`openapi()` + `aomex openapi`，見 [OpenAPI 落盤](/zh-TW/console/openapi)。

要瀏覽器裡點開看契約：[Swagger UI](/zh-TW/plugins/swagger-ui) · [Redoc UI](/zh-TW/plugins/redoc-ui)。

能掛在路由上的 response 儘量用 `response()` 維護，別隻靠 fix 手改每一條。忘記 docs.summary / tags 時生成仍能用，對接方翻文件會痛苦。提供 JSON 的那條路由通常設 `docs.showInOpenapi: false`，避免遞迴描述自己。

## 相關

- [約束響應](/zh-TW/web/response)
- [響應體套殼](/zh-TW/web/envelope)（傳 `app` 時自動把成敗支收成 200；`skipEnvelope` 的狀態碼原樣保留）
- [錯誤格式](/zh-TW/web/errors)
- [OpenAPI 落盤](/zh-TW/console/openapi)
- [Swagger UI](/zh-TW/plugins/swagger-ui) · [Redoc UI](/zh-TW/plugins/redoc-ui)
