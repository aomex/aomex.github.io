---
outline: deep
---

# 安全报文 Helmet

给面向浏览器的响应加一组默认合理的 HTTP 安全头（防点击劫持、MIME 嗅探等），降低常见前端风险。纯 JSON API 可选；有 H5、管理后台、文档站时常见做法是默认挂上，CSP 再按真实资源收紧。

基于上游 [helmet](https://github.com/helmetjs/helmet)，选项与其 HelmetOptions 一致，细节见 [helmet 文档](https://helmetjs.github.io/)。

```bash
pnpm add @aomex/helmet
```

## WebApp 默认整包

无参 `helmet()` 会加上游默认的一组浏览器安全头；有 HTML、文档站、管理台时常见做法是进 `WebApp.mount`，纯 JSON API 可按需省略。

```typescript
import { helmet } from '@aomex/helmet';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    helmet(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

与 [CORS](/zh/plugins/cors) 同用时，两者都放在 routers 前即可；头也可以在反代层加，应用内挂更顺手做按环境切换。

返回普通 WebMiddleware，不改 ctx 业务字段。浏览器开发者工具 → Network → 响应头里能看到 X-Content-Type-Options、X-Frame-Options 等（具体组合随 helmet 默认与子配置而变）。

## CSP 与环境分支

有前端页面时，在无参整包之上收紧 `contentSecurityPolicy`：按 CDN / 脚本域名写白名单。Swagger / ReDoc 内联脚本起不来时，开发或文档路由可临时 `contentSecurityPolicy: false`。

生产收紧 CSP（骨架，按真实资源改）：

```typescript
helmet({
  contentSecurityPolicy: { // [!code highlight]
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
    },
  },
});
```

本地少摩擦、上线收紧，常见按环境分支：

```typescript
const security =
  process.env.NODE_ENV === 'production'
    ? helmet()
    : helmet({ contentSecurityPolicy: false }); // [!code highlight]

mount: [security, cors(), routers('./src/routers')];
```

| 环境 | 建议 |
| --- | --- |
| 生产（有管理端 / H5） | 开启，CSP 对照前端资源清单 |
| 生产（仅 JSON、无 HTML） | 可选；网关已统一加头时可省略 |
| 本地 | 文档站 / Swagger 可 `contentSecurityPolicy: false` |

CSP 从严抄模板却忘放行 CDN / 脚本域名时，页面白屏、控制台一堆 CSP 报错。生产为省事关 CSP 会放大内联脚本面，和上线收紧目标相反。Helmet **不替** [CORS](/zh/plugins/cors)，跨域仍要单独配。

## 下一步

- 跨域：[CORS](/zh/plugins/cors)
- Cookie 登录防伪造：[CSRF](/zh/plugins/csrf)
- 公开 API 文档 UI：[Swagger UI](/zh/openapi/swagger-ui)、[Redoc UI](/zh/openapi/redoc-ui)
- 中间件挂载位置：[中间件](/zh/core/middleware)