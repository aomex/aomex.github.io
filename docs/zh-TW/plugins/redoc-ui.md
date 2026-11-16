---
outline: deep
---

# Redoc UI

給產品、對接方一份**適合長文閱讀**的 API 說明：左側導航、摺疊 schema，比 Swagger 清爽。Redoc **不能在頁內直接試調**——聯調仍靠 [Swagger UI](/zh-TW/plugins/swagger-ui) 或自己的客戶端。兩份 UI 可以同站並存，注意 **路由字首不要重複**。

契約來源：[OpenAPI 生成](/zh-TW/plugins/openapi) · [OpenAPI 落盤](/zh-TW/console/openapi)。

```bash
pnpm add @aomex/redoc-ui
```

mount 裡掛 redocUI，團隊開啟 /redoc（預設）即可讀同一份 OpenAPI（JSON 或 YAML 路徑都行）。

## 與 Swagger 分字首並存

```typescript
import { redocUI } from '@aomex/redoc-ui';
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

mount: [ // [!code focus:13]
  redocUI({
    openapi: './openapi.yaml', // [!code highlight]
    // 或与 Swagger 一样用函数：
    // openapi: () => {
    //   return generateOpenapi({
    //     routers: './src/routers',
    //     app,
    //   });
    // },
  }),
  routers('./src/routers'),
],
```

需要和 Swagger 並存時：

```typescript
mount: [
  swaggerUI({ openapi: './openapi.json', uriPrefix: '/swagger' }),
  redocUI({ openapi: './openapi.json', uriPrefix: '/redoc' }), // [!code highlight]
  routers('./src/routers'),
],
```

::: warning
Redoc **不能在頁內試調**；別讓 QA 把它當成 Swagger 替代品。與 Swagger 並存時兩個 uriPrefix 要分開（如 /redoc 與 /swagger）。
:::

與 Swagger UI 類似：redocUI 是 Web 中介軟體配置，不改變業務路由上 ctx 的型別。openapi 為字串路徑或非同步返回 Document 的函式；函式寫法下 `generateOpenapi` 的選項型別與 [OpenAPI 生成](/zh-TW/plugins/openapi) 篇一致。

訪問控制、uriPrefix、enable 等選項和 Swagger 外掛**同一套思路**——具體欄位以安裝包的型別提示為準，按型別補全即可。

## 何時用 Redoc 而非 Swagger

| 什麼時候用 | 建議 |
| --- | --- |
| 對外 PDF / 交接文件 | Redoc 閱讀體驗更好，落盤契約 + 固定 URL |
| 開發自測、調介面 | 再加 Swagger UI 或 Postman |
| 契約頻繁變 | `openapi: () => generateOpenapi(...)`，或 CI 落盤後兩者共讀一份檔案 |
| 生產暴露 | 與 Swagger 一樣用 `enable` / 內網 / 閘道器鑑權 |

靜態 openapi.yaml 路徑寫錯或構建未複製檔案時，線上會 404。契約走落盤時，改路由後記得跑 [OpenAPI 落盤](/zh-TW/console/openapi)。

## 相關

- [Swagger UI](/zh-TW/plugins/swagger-ui)
- [OpenAPI 生成](/zh-TW/plugins/openapi)
- [OpenAPI 落盤](/zh-TW/console/openapi)