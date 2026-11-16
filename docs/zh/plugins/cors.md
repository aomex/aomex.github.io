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

本地前后端不同端口时，无参 cors() 一般会反射请求头里的 Origin，够用。上线请改成明示域名。

cors() 返回普通 WebMiddleware，不往 ctx 上挂新字段；业务 action 里照常写，跨域由响应头解决。浏览器里成功时能看到 Access-Control-Allow-Origin；带 Cookie 的场景还要 Access-Control-Allow-Credentials: true，且 **不能** 用 origin: '*'。

## 收紧 Origin 与凭据

| 选项 | 什么时候用 | 默认 |
| --- | --- | --- |
| `origin` | 生产固定前端域名，或多套前端用函数对照白名单 | 反射请求 `Origin` |
| `credentials` | 跨域要带 Cookie / 鉴权头 | — |
| `allowHeaders` | 前端要带 `Authorization` 等自定义头 | — |
| `exposeHeaders` | 前端要读 `X-Request-Id` 等响应头 | — |
| `maxAge` | 减少重复 OPTIONS；调试可 `-1` 不缓存 | `3600` |
| `allowMethods` | 只开放 GET/POST 时收紧 | 常见动词全集 |
| `secureContext` / `privateNetworkAccess` | 隔离页面、公网页访问内网 API（Chrome PNA） | `false` |

### 生产：Cookie + 单站前端

```typescript
cors({
  origin: 'https://app.example.com', // [!code highlight]
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-Request-Id'],
});
```

::: warning
credentials: true 时 **不能** 用 origin: '*'：浏览器会直接拒绝。
:::

### 生产：多套前端白名单

```typescript
const allowlist = new Set([
  'https://app.example.com',
  'https://admin.example.com',
]);

cors({
  origin: (ctx) => { // [!code highlight]
    const origin = ctx.request.headers['origin'];
    if (origin && allowlist.has(origin)) {
      return origin;
    }
    return false;
  },
  credentials: true,
});
```

| 环境 | 建议 |
| --- | --- |
| 本地 | 无参 `cors()` 或白名单里加 `http://localhost:5173` |
| 生产 | 禁止反射任意 `Origin`；`credentials` 时 origin 必须具体域名 |

生产仍用默认反射等于对任意站点敞开接口，叠 Cookie 更危险。只改 Web API、忘了文档站 / Swagger / 管理端的 origin 时，预检会在这些域名上失败。

## 下一步

- 挂载顺序与洋葱模型：[中间件](/zh/core/middleware)
- 安全响应头（常与 CORS 同排）：[Helmet](/zh/plugins/helmet)
- 全站观测：[HTTP 访问日志](/zh/plugins/http-access-log)