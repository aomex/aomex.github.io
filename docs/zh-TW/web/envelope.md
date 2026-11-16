---
outline: deep
---

# 響應體套殼

很多團隊希望**成功和失敗都走同一種 JSON 外殼**（例如 `{ success, data, statusCode }`），外層 HTTP 固定 **200**，真實業務碼寫在 body 裡。`WebApp.envelope` 就是幹這個的：在響應真正寫出前，把原來的 body 和狀態碼按你宣告的結構包一層。

路由裡仍照常 `ctx.send(201, …)` / `ctx.throw(400, …)`；套殼發生在 flush 階段，你不用在每個 action 手寫外殼。

```typescript
import { rule } from '@aomex/common';
import { envelope, formatError, routers, WebApp } from '@aomex/web';

new WebApp({
  // services / logger / language / proxyIP —— 见 [应用入口](/zh-TW/web/)
  envelope: { // [!code focus:7]
    content: {
      success: envelope.success, // [!code highlight]
      statusCode: envelope.statusCode,
      data: envelope.payload,
    },
  },
  mount: [
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

配好之後：

- `ctx.send(201, { id: 1 })` → HTTP **200**，body 類似 `{ success: true, statusCode: 201, data: { id: 1 } }`
- `ctx.throw(400, …)`（配合 formatError）→ HTTP **200**，`success: false`，`data` 裡是錯誤 JSON；真實 **400** 在 `statusCode` 槽

客戶端要認 body 裡的成功與否，**不能只看 HTTP 狀態碼**（重定向、無內容響應除外，見下文）。

## 內建槽位

`content` 是一棵宣告樹，葉子只能是內建槽或 `envelope.slot`，也可以巢狀普通物件。別直接塞 `rule.string()`——沒有執行時取值來源。

| 槽位 | 執行時含義 |
| --- | --- |
| `envelope.success` | 原狀態碼是否 `< 400`（業務上算不算成功） |
| `envelope.payload` | 套殼前的響應 body（json / string / null） |
| `envelope.statusCode` | 套殼前的 HTTP 狀態碼（寫出後外層仍是 200） |

欄位名叫 `data`、`result` 還是 `payload` 由你定：把內建槽掛到哪個鍵上即可。

## 自定義槽與巢狀

需要版本號、追蹤欄位等固定或派生值時，用 `envelope.slot(schema, get)`：`schema` 給 OpenAPI，`get` 只讀 `{ success, payload, statusCode }`。

```typescript
envelope: {
  content: {
    meta: {
      ok: envelope.success,
      code: envelope.statusCode,
      version: envelope.slot(rule.string(), () => '1.0'), // [!code highlight]
    },
    result: envelope.payload,
  },
},
```

`get` 裡別依賴 ctx、services 等其它上下文——套殼階段只能看到上面三個變數。

## 和 formatError、response() 的關係

- **[formatError](/zh-TW/web/errors)**：先把 `ctx.throw` 收成統一錯誤 JSON，再作為 `envelope.payload` 裝進外殼。推薦一起配；不掛 formatError 時，預設純文本錯誤也會進 payload（變成 JSON 字串值）。
- **[response()](/zh-TW/web/response)**：仍按「真實」狀態碼宣告成功/失敗體形狀；套殼不改變你在 action 裡怎麼 send / throw，只改寫出前的外殼。OpenAPI 裡成敗支會被收成 200 下的套殼 schema（見下）。

業務程式碼繼續寫 `send(201)`、`throw(404)`，型別與路由宣告不用改成「永遠 200」。

## 不會套殼的情況

下列響應**原樣寫出**，不包外殼、也不改成 200：

| 情況 | 原因 |
| --- | --- |
| **3xx** 重定向 | Location 等語義不能改成 JSON 外殼 |
| **204 / 205 / 304** 等無內容狀態碼 | 本身沒有 body |
| **SSE**（`text/event-stream`） | 流式幀協議，不能整包緩衝成一個 JSON |
| **Buffer / Stream** 體 | 二進位制或流式下載，不適合套 JSON |

普通 json / string / null（含未顯式 send 的預設 404）都會套。

## OpenAPI

給 `generateOpenapi` / Console `openapi()` 傳入**配置了 envelope 的同一份 `WebApp`（`app`）**時，生成器會自動讀 `app` 上的套殼配置：在其它 `response` / `formatError` 注入之後，把文件裡的 2xx 與 4xx·5xx·default **收成 HTTP 200** 的套殼 schema（成敗常用 `oneOf`，`success` 分別固定為 `true` / `false`）；**保留** 3xx 與 204 等無內容狀態碼，和執行時跳過規則一致。

`envelope.description` 會寫到收攏後的 `200` 響應說明上。不必再手傳一份 `mount` 陣列，也別漏傳 `app`——否則契約仍是「201 + 裸 body」、線上卻是「200 + 外殼」。詳見 [OpenAPI 生成](/zh-TW/plugins/openapi)。

## 下一步

- [錯誤格式](/zh-TW/web/errors)：`formatError` 與套殼的 payload
- [約束響應](/zh-TW/web/response)：路由上宣告真實狀態碼與內層 content
- [OpenAPI 生成](/zh-TW/plugins/openapi)：契約如何掃路由
- [Web 應用入口](/zh-TW/web/)：`WebApp` 其它必填項
