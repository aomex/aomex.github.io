---
outline: deep
---

# 錯誤格式

讓全站（或某個模組）的 ctx.throw 變成統一的 JSON 信封，而不是預設純文本：在 mount 上掛 formatError，用 handler 決定最終 body，用 content 鎖定型別和 OpenAPI。改形狀走這裡，別在 app.on('error') 裡硬改 body——時機晚，容易和已寫出的響應打架。

```typescript
import { rule } from '@aomex/common';
import { formatError, routers, WebApp } from '@aomex/web';

new WebApp({
  // services / logger / language / proxyIP —— 见 [应用入口](/zh-TW/web/)
  mount: [
    formatError({ // [!code focus:13]
      content: { // [!code highlight]
        code: rule.string(),
        message: rule.string(),
      },
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

把 `formatError` 掛在 routers **外面、靠前**，這樣任意路由裡 throw，只要沒被更內層接住，都會進這個 handler。

handler 返回值形狀要對齊 content；`ctx.throw(403, { code: 'FORBIDDEN' })` 時業務碼多在 err.code，文案在已淨化的 err.message。省略 statusCodes 時，這一層接管**全部** 4xx / 5xx。路由上 `response({ statusCode: 400 })` 且沒寫 content 時，生成文件往往會借用外層 formatError 的錯誤形狀。不掛 formatError 時，客戶端仍是框架預設的純文本錯誤。

接手時一般會清掉當前響應上已有的頭，再按錯誤碼重設狀態並 send 新 body。別把 err.raw、堆疊、SQL 寫進 handler 返回值——對外只給淨化後的資訊。

## 模組內層信封

全域性 formatError 管整站預設形狀；**/admin** 或開放 API 子域若要另一套欄位名（`error` / `detail` 而不是 `code` / `message`），在對應 `Router({ mount: [formatError(...)] })` 裡再掛一層。洋蔥內側先接住 throw，該字首下的路由走內層信封，其它路徑仍用外層。

/admin 要另一套欄位名時，在 Router 內再掛一層：

```typescript
import { formatError, Router } from '@aomex/web';

const adminRouter = new Router({ // [!code focus:18]
  prefix: '/admin',
  mount: [
    formatError({ // [!code highlight]
      content: {
        error: rule.string(),
        detail: rule.string().optional(),
      },
      handler(err) {
        return {
          error: err.code ?? 'ADMIN_ERROR',
          detail: err.message,
        };
      },
    }),
    auth.authenticate('bearer'),
  ],
});
```

洋蔥裡**內側先 catch**：/admin/* 走內層形狀，其它路由繼續用全域性兜底。

## statusCodes 區域性接管

`statusCodes` 限定**這一層** formatError 只處理列出的 HTTP 狀態碼（常見只包 400、422 等校驗類）。其它 4xx / 5xx 繼續冒泡到外層 handler，適合「校驗錯誤統一 JSON、業務 403 仍走全域性信封」的分工。

只想管校驗類錯誤，其它碼交給外層：

```typescript
formatError({ // [!code highlight]
  statusCodes: [400, 422],
  content: {
    code: rule.string(),
    message: rule.string(),
  },
  handler(err) {
    return {
      code: err.code ?? 'VALIDATION',
      message: err.message,
    };
  },
}),
```

## 和路由 throw 配合

路由裡用 `ctx.throw(status, …)` 主動結束請求並走錯誤鏈：缺資源 **404**、引數業務校驗 **400**、許可權 **403** 等。第二參可以是字串或帶 `code` 的物件，formatError 的 handler 從 `err` 上取碼和文案拼進 content。

```typescript
ctx.throw(404);
ctx.throw(400, 'name required');
ctx.throw(403, { code: 'FORBIDDEN' });
```

業務裡若已誤寫過頭或 body 再 throw，交給 formatError 整份替換即可，別在 action 裡拼一半錯誤 JSON。

若還要把成功體和錯誤體再包進同一層 `{ success, data, statusCode }`、外層 HTTP 固定 200，見 [響應體套殼](/zh-TW/web/envelope)（常與 formatError 一起配）。

## 下一步

- [響應體套殼](/zh-TW/web/envelope)（統一外殼與 HTTP 200）
- [約束響應](/zh-TW/web/response)（每條路由宣告 400/404 等）
- [應用入口](/zh-TW/web/)（services / logger / language 等全域性配置）
- [WebApp.language](/zh-TW/web/#language)（校驗與錯誤文案語言）