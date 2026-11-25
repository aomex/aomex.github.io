---
outline: deep
---

# CSRF 防護

瀏覽器會自動帶上同站 Cookie。攻擊者的頁面若誘使你的瀏覽器對你的 API 發 POST，**HttpOnly 的登入 Cookie 也會被帶上**——這就是跨站請求偽造。`@aomex/csrf` 用**雙提交 Cookie**：服務端簽發可讀的 `csrfToken` Cookie，前端把同一值寫進請求頭；兩邊一致才放行寫操作。

和 [Session](/zh-TW/plugins/auth-session-strategy) 幾乎總是成對出現；只用 Bearer 頭、不依賴 Cookie 登入態時，通常不必掛 CSRF。

```bash
pnpm add @aomex/csrf
```

## 掛在 routers 之前

無參 `csrf()` 即可：GET/HEAD/OPTIONS 只負責簽發或沿用 Cookie，不校驗頭；POST 等寫方法要求 Cookie 與 `x-csrf-token` 一致，否則 **403**。

```typescript
import { cors } from '@aomex/cors';
import { csrf } from '@aomex/csrf';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:5]
    cors({ origin: 'https://app.example.com', credentials: true }),
    csrf(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

::: warning
必須掛在 routers **之前**。校驗失敗走錯誤中介軟體時，若 csrf 在後面，剛簽發的 `Set-Cookie` 可能到不了瀏覽器，前端會一直缺 token。
:::

中介軟體會往 ctx 掛 `csrfToken`（當前 token 字串）。Cookie **強制** `httpOnly: false`（雙提交要求 JS 可讀）；其餘屬性（`sameSite` / `path` / `maxAge`）可配，預設與 `setCookie` 一致（含 `SameSite=Strict`）。

跨域還要帶登入 Cookie 時，CORS 須 `credentials: true` 且 **顯式** `origin`，並在 `allowHeaders` 放行 `x-csrf-token`。見 [CORS](/zh-TW/plugins/cors) 與 [Session](/zh-TW/plugins/auth-session-strategy)。

## 前端怎麼帶

1. 先發任意 GET（或開啟頁面），響應裡會有 `Set-Cookie: csrfToken=...`
2. 用 `document.cookie`（或你的 cookie 工具）讀出值
3. 寫請求加上頭 `x-csrf-token: <同一值>`，並 `credentials: 'include'`（若還依賴登入 Cookie）

```typescript
function readCsrfToken() {
  const row = document.cookie
    .split('; ')
    .find((line) => {
      return line.startsWith('csrfToken=');
    });
  return row?.slice('csrfToken='.length);
}

await fetch('/api/orders', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': readCsrfToken()!, // [!code highlight]
  },
  body: JSON.stringify({ sku: 'A1' }),
});
```

首次就對無 Cookie 的介面直接 POST：會 **403**，但響應裡仍可能帶上新簽發的 `Set-Cookie`，前端讀到後再重試即可。

## 對齊前端約定

前端已用 `x-xsrf-token`、或 Cookie 名不是 `csrfToken` 時，在構造引數裡對齊即可；`httpOnly` 仍會被強制關掉。

```typescript
csrf({
  cookie: { name: 'XSRF-TOKEN', sameSite: 'lax', maxAge: 86400 }, // [!code highlight]
  headerName: 'x-xsrf-token',
});
```

`sameSite` / `path` / `secure` / `maxAge` 跟業務 Cookie 策略走；跨站前端常把 `sameSite` 調成 `lax`。

## 放行 webhook 與健康檢查

第三方回撥、負載均衡探活沒有瀏覽器 Cookie，也不該走雙提交。用 `ignore` 按路徑跳過；別全域性關掉 CSRF。

```typescript
csrf({
  ignore: (ctx) => { // [!code focus:3]
    return ctx.request.pathname.startsWith('/webhooks/');
  },
});
```

只讀 Header + Cookie，**不讀 body**，和 `body()` 解析互不干擾。預設不校驗的方法是 GET / HEAD / OPTIONS；極少需要改 `ignoreMethods`。

## 相關

- [Session 策略](/zh-TW/plugins/auth-session-strategy)
- [跨域 CORS](/zh-TW/plugins/cors)
- [安全報文 Helmet](/zh-TW/plugins/helmet)
