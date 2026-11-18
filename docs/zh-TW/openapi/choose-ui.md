---
outline: deep
---

# 怎麼選文件 UI

aomex 提供三套文件頁外掛：[Swagger UI](/zh-TW/openapi/swagger-ui)、[Redoc UI](/zh-TW/openapi/redoc-ui)、[Scalar UI](/zh-TW/openapi/scalar-ui)。它們讀的是**同一份** OpenAPI 契約（落盤的 `openapi.json` / yaml，或執行時 `generateOpenapi`），差別在**閱讀體驗**和**能不能在頁內試調**。

本頁幫你按讀者與場景選型；裝包、掛 mount、`uriPrefix` / `enable` 等細節進各 UI 專頁。契約怎麼生成見 [生成OpenAPI](/zh-TW/openapi/)。

## 一句話對照

| | [Swagger UI](/zh-TW/openapi/swagger-ui) | [Redoc UI](/zh-TW/openapi/redoc-ui) | [Scalar UI](/zh-TW/openapi/scalar-ui) |
| --- | --- | --- | --- |
| 預設字首 | `/swagger` | `/redoc` | `/scalar` |
| 頁內試調 | 有（Try it out） | **沒有** | 有 |
| 閱讀體驗 | 偏操作檯，欄位密 | 左側導航、長文友好 | 現代排版，讀 + 調兼顧 |
| 典型讀者 | 開發、QA 聯調 | 產品、對接方、交接文件 | 既要讀又要隨手打 API |
| 包名 | `@aomex/swagger-ui` | `@aomex/redoc-ui` | `@aomex/scalar-ui` |

三套都是普通 Web 中介軟體：掛上就出頁面，**不改變**業務路由上 `ctx` 的型別。全站開了 [envelope](/zh-TW/web/envelope) 時，文件頁會自動 `skipEnvelope`，不會被套殼。

## 按場景選

| 你現在在幹嘛 | 優先選 | 原因 |
| --- | --- | --- |
| 本機 / 內網點開就調 API | Swagger 或 Scalar | 頁內能發真實請求；團隊熟 Try it out 就 Swagger，想要更新一點的介面就 Scalar |
| 給對接方一份「說明書」URL | Redoc | 長文、schema 摺疊更清爽；別指望對方在頁裡試調 |
| 對外 PDF / 週報附件式 API 說明 | Redoc | 印刷 / 滾動閱讀體驗更好 |
| 新人 onboarding：先讀再試 | Scalar，或 Redoc + Swagger 並存 | 一套頁裡讀完再試；或「讀」與「調」拆成兩個連結 |
| 舊專案同事只會 Swagger | 繼續 Swagger | 學習成本最低；不必為換皮推倒重來 |
| 多種讀者（產品 + 研發） | **並存**，分 `uriPrefix` | 同一份契約喂多套 UI，見下文 |

拿不準時：開發期先掛 **Scalar** 或 **Swagger** 之一就能幹活；對外說明再加 **Redoc**。沒有「必須三選一」——契約源只有一份。

## 能力邊界（別踩錯）

**頁內試調** = 瀏覽器裡填引數、帶鑑權、打到真實（或閘道器後的）服務。Swagger 與 Scalar 有；Redoc **沒有**。

```typescript
// Redoc 只负责展示契约——联调请另开 Swagger / Scalar / Postman
mount: [
  redocUI({ openapi: './openapi.json', uriPrefix: '/redoc-…' }),
  swaggerUI({ openapi: './openapi.json', uriPrefix: '/swagger-…' }),
  routers('./src/routers'),
],
```

::: warning
別讓 QA / 對接方把 Redoc 當成「能點 Try it out 的 Swagger」。連結發錯時，對方只能讀不能調，會誤以為API 壞了。
:::

其它邊界：

- 文件 UI **不是** 鑑權方案：公網暴露等於交出 API 地圖（可試調的還會交出試調入口）。
- 預設 `/swagger`、`/redoc`、`/scalar` 太好猜——`uriPrefix` 建議帶**隨機串**，並配合 `enable` / 內網 / 閘道器；細則見各 UI 專頁。
- 動態 `openapi: () => generateOpenapi(...)` 必須傳入與線上一致的 `app`，security / envelope 才不會和真環境兩套皮。

## 同站並存

三套（或任意兩套）可以掛在同一個 `WebApp` 上，**字首必須分開**，契約可以共用一個檔案：

```typescript
import { swaggerUI } from '@aomex/swagger-ui';
import { redocUI } from '@aomex/redoc-ui';
import { scalarUI } from '@aomex/scalar-ui';

mount: [ // [!code focus:13]
  swaggerUI({
    openapi: './openapi.json',
    uriPrefix: '/swagger-7c3e9a1f02b48d6e',
  }),
  redocUI({
    openapi: './openapi.json',
    uriPrefix: '/redoc-a1b2c3d4e5f60718',
  }),
  scalarUI({
    openapi: './openapi.json',
    uriPrefix: '/scalar-9f8e7d6c5b4a3210',
  }),
  routers('./src/routers'),
],
```

生產只對內網開放、或按 IP / token 開關時，三套的 `enable` 可以寫成同一套判斷（複製或抽成函式），避免漏關其中一套。

## 和「生成契約」怎麼配合

| 契約從哪來 | 適合 UI 怎麼讀 |
| --- | --- |
| CI `aomex openapi` 落盤 | 三套都 `openapi: './openapi.json'`（或 yaml）——改路由後記得重新落盤 |
| 執行時 `generateOpenapi` | `openapi: () => generateOpenapi({ routers, app })`——省檔案，注意同一份 `app` |
| 只給對接方靜態站 | 往往只要 Redoc + 落盤檔案；試調入口放內網 |

文件站高頻線上掃全站路由費 CPU：生產對外頁多數用**落盤 + UI 讀檔案**；開發期用動態生成更省事。完整落盤流程見 [生成OpenAPI](/zh-TW/openapi/)。

## 選型速查

| 問題 | 答案 |
| --- | --- |
| 只要一個、要能試調 | Scalar 或 Swagger |
| 只要一個、只要好看的說明書 | Redoc |
| 產品讀、研發調 | Redoc +（Swagger 或 Scalar） |
| 團隊已有 Swagger 書籤 / 錄屏 | 先別換，加 Redoc / Scalar 即可 |
| 擔心公網被掃 | 隨機 `uriPrefix` + `enable`，三套同樣處理 |

裝好之後的配置、生產 `enable`、隨機字首示例：

- [Swagger UI](/zh-TW/openapi/swagger-ui)
- [Redoc UI](/zh-TW/openapi/redoc-ui)
- [Scalar UI](/zh-TW/openapi/scalar-ui)

## 相關

- [生成OpenAPI](/zh-TW/openapi/)
- [Tags 分組](/zh-TW/openapi/tags) · [Markdown 文案](/zh-TW/openapi/markdown)
