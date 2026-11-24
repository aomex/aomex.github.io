---
outline: deep
---

# 跨域 CORS

让浏览器里的前端页面能合法请求你的 API：开发时前后端分端口要过预检；生产时要收紧「允许哪几个 origin」，需要 Cookie 时还要配上 credentials。

```bash
pnpm add @aomex/cors
```

## 挂在 routers 之前

`cors()` 在中间件阶段写 Access-Control-* 响应头，让浏览器允许跨源读响应体。必须挂在 `routers` **之前**，全站响应（含 4xx/5xx）才会带头，否则预检过了、业务报错时前端却读不到错误体。

```typescript
import { cors } from '@aomex/cors';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    cors(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

::: warning
CORS 挂在 routers **后面** 时，404 和校验 400 可能缺头，浏览器报「跨域」会把真因盖住。
:::

本地前后端不同端口、**又不带 Cookie** 时，无参 `cors()` 会反射请求头里的 Origin，一般够用。一旦要跨域带 Cookie（[Session](/zh/plugins/auth-session-strategy)），就必须显式写 origin，见下一节。

cors() 返回普通 WebMiddleware，不往 ctx 上挂新字段；业务 action 里照常写，跨域由响应头解决。浏览器里成功时能看到 Access-Control-Allow-Origin；带 Cookie 的场景还要 Access-Control-Allow-Credentials: true，且 **不能** 用 origin: '*'。

## Cookie 登录：必须显式 origin

`credentials: true`（或函数返回 `true`）时：

- **必须**显式配置 `origin`（具体域名、白名单数组、或返回具体来源的函数）
- **禁止**依赖无参 cors() 的默认反射——漏配会在创建或请求阶段直接抛错
- **禁止** `origin: '*'`（浏览器也不认这种组合）

前端还要带 `Authorization`、`x-csrf-token` 时，用 `allowHeaders` 放行；要让前端脚本读到 `X-Request-Id` 等自定义头，用 `exposeHeaders`。

```typescript
cors({
  origin: 'https://app.example.com', // [!code highlight]
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
  exposeHeaders: ['X-Request-Id'],
});
```

::: warning
开了 credentials 却不写 origin，或写成 `*`，应用起不来或一请求就抛错——这是有意拦住「反射任意 Origin + Cookie」的危险默认。
:::

Session 还要挂 [CSRF](/zh/plugins/csrf)，并让前端 `fetch` 使用 `credentials: 'include'`。完整链路见 [Session 策略](/zh/plugins/auth-session-strategy)。

## 多套前端白名单

App 与管理端分域名时，`origin` 可以直接给数组；命中才回写，未命中等于不启用 CORS。

```typescript
const allowlist = [
  'https://app.example.com',
  'https://admin.example.com',
];

cors({
  origin: allowlist, // [!code highlight]
  credentials: true,
  allowHeaders: ['Content-Type', 'x-csrf-token'],
});
```

也可用函数按请求返回具体 origin（命中白名单才回写；未命中返回 `undefined` 表示不启用 CORS）：

```typescript
cors({
  origin: (ctx) => {
    const origin = ctx.request.headers['origin'];
    if (typeof origin === 'string' && allowlist.includes(origin)) {
      return origin;
    }
    return undefined;
  },
  credentials: true,
});
```

预检缓存默认约一小时（`maxAge: 3600`）；本地调试可设 `-1` 让每次 OPTIONS 都重新打。只开放 GET/POST 时再用 `allowMethods` 收紧。隔离页面 / 公网页访问内网 API（Chrome PNA）才需要 `secureContext` / `privateNetworkAccess`。

| 环境 | 建议 |
| --- | --- |
| 本地（不带 Cookie） | 无参 `cors()` |
| 本地（Session） | `origin: 'http://localhost:5173'` + `credentials: true` |
| 生产 | 明示域名或白名单；开凭证时绝不用默认反射 |

只改 Web API、忘了文档站 / Swagger / 管理端的 origin 时，预检会在这些域名上失败。

## 下一步

- Cookie 登录整条链：[Session 策略](/zh/plugins/auth-session-strategy)
- 写请求防伪造：[CSRF](/zh/plugins/csrf)
- 挂载顺序与洋葱模型：[中间件](/zh/core/middleware)
- 安全响应头（常与 CORS 同排）：[Helmet](/zh/plugins/helmet)
- 全站观测：[HTTP 访问日志](/zh/plugins/http-access-log)
