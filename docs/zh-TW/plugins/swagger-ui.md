---
outline: deep
---

# Swagger UI

在本機或內網掛一份**點開就能試調**的 API 文件。前提是一份 OpenAPI Document（落盤的 openapi.json 或執行時 `generateOpenapi`）。長文閱讀可看 [Redoc UI](/zh-TW/plugins/redoc-ui)；兩者可並存，**字首別撞車**。

契約從哪來：[OpenAPI 生成](/zh-TW/plugins/openapi) · [OpenAPI 落盤](/zh-TW/console/openapi)。

```bash
pnpm add @aomex/swagger-ui
```

在 `WebApp.mount` 裡掛 swaggerUI，開發同事開啟 /swagger（或你設的 prefix）就能瀏覽並 Try it out。

## 落盤檔案或動態 generateOpenapi

**CI 已落盤**（常見）：

```typescript
import { swaggerUI } from '@aomex/swagger-ui';

mount: [
  swaggerUI({ openapi: './openapi.json' }), // [!code highlight]
  routers('./src/routers'),
],
```

瀏覽器：/swagger（或 /swagger/index.html），規範 JSON 一般在同字首下的 openapi.json。

**與線上路由同步**（不維護靜態檔案）：

```typescript
import { swaggerUI } from '@aomex/swagger-ui';
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

mount: [ // [!code focus:12]
  swaggerUI({
    uriPrefix: '/docs',
    openapi: () => { // [!code highlight]
      return generateOpenapi({
        routers: './src/routers',
        app,
      });
    },
  }),
  routers('./src/routers'),
],
```

swaggerUI 掛在 mount 裡，型別上是普通 Web 中介軟體，不改編譯器對業務路由的推斷。openapi 傳**路徑字串**或**返回 `Promise<Document>` 的函式**均可；傳函式時請把**同一份** `WebApp`（`app`）交給 `generateOpenapi`，否則文件裡的 security / envelope 會和真環境兩套皮。

enable 若寫成函式，引數裡能拿到請求上下文，用來做內網門檻——返回值是 boolean 時可被型別檢查兜住。

## uriPrefix 與生產 enable

| 選項 / 寫法 | 什麼時候用 |
| --- | --- |
| `openapi: './openapi.json'` | CI `aomex openapi` 落盤後託管 |
| `openapi: () => generateOpenapi(...)` | 省得提交契約檔案；注意傳入同一份 `app` |
| `uriPrefix` | 不想佔用預設 `/swagger` 時改字首 |
| `enable` | 生產公網要關文件或加 token / IP 白名單 |

生產限制示例：

```typescript
swaggerUI({
  openapi: './openapi.json',
  enable: (ctx) => { // [!code highlight]
    const ipOk = ctx!.request.ip === '127.0.0.1';
    const tokenOk =
      ctx!.request.headers['x-docs-token'] === process.env.DOCS_TOKEN;
    return ipOk || tokenOk;
  },
});
```

掛的位置：一般放在 routers 之前或之後都能用，但**別和業務 API 字首衝突**（例如業務也用 /docs 會和 uriPrefix: '/docs' 搶路徑）；和 redocUI 同時開時兩個 uriPrefix 要分開。

::: warning
公網裸奔 Swagger 等於把 API 地圖和 Try it out 一起送人；至少加 enable 或做網路隔離。
:::

動態 `openapi: () => generateOpenapi(...)` 忘了傳與線上一致的 `app` 時，頁面上會顯示「無需鑑權」、也缺套殼形狀，聯調卻 401。靜態 openapi.json 模式下只改程式碼不更新檔案，UI 仍是舊契約。

## 相關

- [Redoc UI](/zh-TW/plugins/redoc-ui)
- [OpenAPI 生成](/zh-TW/plugins/openapi)
- [OpenAPI 落盤](/zh-TW/console/openapi)