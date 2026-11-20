---
outline: deep
---

# CSRF 防护

浏览器会自动带上同站 Cookie。攻击者的页面若诱使你的浏览器对你的 API 发 POST，**HttpOnly 的登录 Cookie 也会被带上**——这就是跨站请求伪造。`@aomex/csrf` 用**双提交 Cookie**：服务端签发可读的 `csrfToken` Cookie，前端把同一值写进请求头；两边一致才放行写操作。

和 [Session](/zh/plugins/auth-session-strategy) 几乎总是成对出现；只用 Bearer 头、不依赖 Cookie 登录态时，通常不必挂 CSRF。

```bash
pnpm add @aomex/csrf
```

## 挂在 routers 之前

无参 `csrf()` 即可：GET/HEAD/OPTIONS 只负责签发或沿用 Cookie，不校验头；POST 等写方法要求 Cookie 与 `x-csrf-token` 一致，否则 **403**。

```typescript
import { cors } from '@aomex/cors';
import { csrf } from '@aomex/csrf';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
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
必须挂在 routers **之前**。校验失败走错误中间件时，若 csrf 在后面，刚签发的 `Set-Cookie` 可能到不了浏览器，前端会一直缺 token。
:::

中间件会往 ctx 挂 `csrfToken`（当前 token 字符串）。Cookie **强制** `httpOnly: false`（双提交要求 JS 可读）；其余属性（`sameSite` / `path` / `maxAge`）可配，默认与 `setCookie` 一致（含 `SameSite=Strict`）。

跨域还要带登录 Cookie 时，CORS 须 `credentials: true` 且 **显式** `origin`，并在 `allowHeaders` 放行 `x-csrf-token`。见 [CORS](/zh/plugins/cors) 与 [Session](/zh/plugins/auth-session-strategy)。

## 前端怎么带

1. 先发任意 GET（或打开页面），响应里会有 `Set-Cookie: csrfToken=...`
2. 用 `document.cookie`（或你的 cookie 工具）读出值
3. 写请求加上头 `x-csrf-token: <同一值>`，并 `credentials: 'include'`（若还依赖登录 Cookie）

```typescript
function readCsrfToken() {
  const row = document.cookie
    .split('; ')
    .find((line) => line.startsWith('csrfToken='));
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

首次就对无 Cookie 的接口直接 POST：会 **403**，但响应里仍可能带上新签发的 `Set-Cookie`，前端读到后再重试即可。

## 选项与跳过

| 选项 | 什么时候用 | 默认 |
| --- | --- | --- |
| `cookie.name` | 与现有前端约定对齐 | `csrfToken` |
| `cookie.sameSite` / `path` / `maxAge` / `secure` | 跨站前端、路径隔离、过期策略 | 与 `setCookie` 默认一致；`httpOnly` 固定 `false` |
| `headerName` | 前端已用别的头名 | `x-csrf-token` |
| `ignoreMethods` | 哪些方法不校验 | `GET`、`HEAD`、`OPTIONS` |
| `ignore` | 健康检查、外部 webhook 等按请求跳过 | — |

```typescript
csrf({
  cookie: { sameSite: 'lax', maxAge: 86400 },
  headerName: 'x-xsrf-token',
  ignore: (ctx) => {
    return ctx.request.pathname.startsWith('/webhooks/');
  },
});
```

只读 Header + Cookie，**不读 body**，和 `body()` 解析互不干扰。Webhook 等无浏览器场景用 `ignore` 放行，别全局关掉 CSRF。

## 相关

- [Session 策略](/zh/plugins/auth-session-strategy)
- [跨域 CORS](/zh/plugins/cors)
- [安全报文 Helmet](/zh/plugins/helmet)
