---
outline: deep
---

# Redoc UI

給產品、對接方一份**適合長文閱讀**的 API 說明：左側導航、摺疊 schema，比 Swagger 清爽。Redoc **不能在頁內直接試調**——聯調仍靠 [Swagger UI](/zh-TW/openapi/swagger-ui)、[Scalar UI](/zh-TW/openapi/scalar-ui) 或自己的客戶端。多套 UI 可以同站並存，注意 **路由字首不要重複**。

想先感受介面：[官方演示](https://redocly.github.io/redoc/)。契約來源：[生成OpenAPI](/zh-TW/openapi/)。

```bash
pnpm add @aomex/redoc-ui
```

mount 裡掛 redocUI，團隊開啟 /redoc（預設）即可讀同一份 OpenAPI（JSON 或 YAML 路徑都行）。

## 與 Swagger 分字首並存

```typescript
import { redocUI } from '@aomex/redoc-ui';
import { generateOpenapi } from '@aomex/openapi-generator';
import { app } from '@/app';

mount: [ // [!code focus:13]
  redocUI({
    openapi: './openapi.yaml', // [!code highlight]
    // 或与 Swagger 一样用函数：
    // openapi: () => {
    //   return generateOpenapi({
    //     routers: './src/routers',
    //     app,
    //     docs: { openapi: '3.2.1' },
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
Redoc **不能在頁內試調**；別讓 QA 把它當成 Swagger 替代品。與其它文件 UI 並存時 `uriPrefix` 要分開，並建議都帶**隨機串**（如 `/redoc-7c3e9a1f02b48d6e`），降低被掃到後濫用的風險——詳見 [Swagger UI](/zh-TW/openapi/swagger-ui)。
:::

與 Swagger UI 類似：redocUI 是 Web 中介軟體配置，不改變業務路由上 ctx 的型別。openapi 為字串路徑或非同步返回 Document 的函式；函式寫法下 `generateOpenapi` 的選項型別與 [生成OpenAPI](/zh-TW/openapi/) 篇一致。

訪問控制、`uriPrefix`（含隨機串）、`enable` 等選項和 Swagger / Scalar **同一套思路**——具體欄位以安裝包的型別提示為準。

```typescript
redocUI({
  openapi: './openapi.json',
  uriPrefix: '/redoc-7c3e9a1f02b48d6e',
});
```

和 Swagger / Scalar 的對照、並存與場景選型見 [怎麼選文件 UI](/zh-TW/openapi/choose-ui)。靜態 `openapi.yaml` 路徑寫錯或構建未複製檔案時，線上會 404；契約走落盤時，改路由後記得再跑 [生成OpenAPI](/zh-TW/openapi/)。

## 相關

- [怎麼選文件 UI](/zh-TW/openapi/choose-ui)
- [Swagger UI](/zh-TW/openapi/swagger-ui) · [Scalar UI](/zh-TW/openapi/scalar-ui)
- [生成OpenAPI](/zh-TW/openapi/)