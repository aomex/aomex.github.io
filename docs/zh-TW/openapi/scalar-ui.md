---
outline: deep
---

# Scalar UI

掛一份基於 [Scalar](https://github.com/scalar/scalar) 的 API 文件頁：閱讀體驗偏現代，也能在頁內試調。契約同樣來自落盤的 openapi.json / yaml，或執行時 `generateOpenapi`。可與 [Swagger UI](/zh-TW/openapi/swagger-ui) / [Redoc UI](/zh-TW/openapi/redoc-ui) 同站並存，**uriPrefix 別撞車**（預設 `/scalar`）。

契約從哪來：[生成OpenAPI](/zh-TW/openapi/)。

```bash
pnpm add @aomex/scalar-ui
```

在 `WebApp.mount` 裡掛 `scalarUI`，開啟 /scalar（或你設的 prefix）即可瀏覽。

## 落盤檔案或動態 generateOpenapi

**CI 已落盤**（常見）：

```typescript
import { scalarUI } from '@aomex/scalar-ui';

mount: [
  scalarUI({ openapi: './openapi.json' }), // [!code highlight]
  routers('./src/routers'),
],
```

也支援 yaml / yml 路徑。瀏覽器：/scalar；同字首下一般還有 openapi.json 供頁面拉取。

**與線上路由同步**：

```typescript
import { scalarUI } from '@aomex/scalar-ui';
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

mount: [ // [!code focus:12]
  scalarUI({
    uriPrefix: '/api-docs',
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

`scalarUI` 是普通 Web 中介軟體。`openapi` 傳路徑字串或返回 Document（可非同步）的函式；傳函式時把**同一份** `WebApp`（`app`）交給 `generateOpenapi`，security / envelope 才不會和真環境兩套皮。全站開了 [envelope](/zh-TW/web/envelope) 時，文件頁會自動 `skipEnvelope`，不會被套殼。

## uriPrefix、enable 與 headTags

| 選項 / 寫法 | 什麼時候用 |
| --- | --- |
| `openapi: './openapi.json'` / `.yaml` | CI `aomex openapi` 落盤後託管 |
| `openapi: () => generateOpenapi(...)` | 省得提交契約檔案；注意同一份 `app` |
| `uriPrefix` | 預設 `/scalar`；建議改成帶**隨機串**的路徑，降低被掃到後濫用的風險 |
| `enable` | 生產公網要關文件或加 token / IP 白名單 |
| `headTags` | 往文件頁 `<head>` 插 favicon、額外 meta / link |

`/scalar`、`/swagger` 這類預設路徑很容易被掃到。給字首加一段隨機串（如 `/scalar-7c3e9a1f02b48d6e`）只抬高撞庫成本，**不能代替** `enable` / 內網隔離——思路與 [Swagger UI](/zh-TW/openapi/swagger-ui) 相同。

```typescript
scalarUI({
  openapi: './openapi.json',
  uriPrefix: '/scalar-7c3e9a1f02b48d6e', // [!code highlight]
  enable: (ctx) => { // [!code highlight]
    const ipOk = ctx!.request.ip === '127.0.0.1';
    const tokenOk =
      ctx!.request.headers['x-docs-token'] === process.env.DOCS_TOKEN;
    return ipOk || tokenOk;
  },
});
```

插站點圖示：

```typescript
scalarUI({
  openapi: './openapi.json',
  headTags: [
    {
      tag: 'link',
      props: {
        rel: 'shortcut icon',
        type: 'image/x-icon',
        href: '/favicon.ico',
      },
    },
  ],
});
```

掛的位置：別和業務 API 字首衝突；與 swaggerUI / redocUI 同時開時三個 `uriPrefix` 都要分開（也都建議帶隨機串）。

::: warning
公網裸奔文件 UI 等於把 API 地圖（以及可試調能力）一起送人；隨機字首 + `enable` / 網路隔離一起用。
:::

動態 `openapi` 忘了傳與線上一致的 `app` 時，頁面上的鑑權 / 套殼形狀會和聯調對不上。靜態檔案模式下改路由後記得再跑 [生成OpenAPI](/zh-TW/openapi/) 落盤。

和 Swagger / Redoc 的對照、並存與場景選型見 [怎麼選文件 UI](/zh-TW/openapi/choose-ui)。

## 相關

- [怎麼選文件 UI](/zh-TW/openapi/choose-ui)
- [Swagger UI](/zh-TW/openapi/swagger-ui) · [Redoc UI](/zh-TW/openapi/redoc-ui)
- [生成OpenAPI](/zh-TW/openapi/)
