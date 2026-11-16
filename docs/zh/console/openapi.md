---
outline: deep
---

# OpenAPI 落盘

在 **不改 HTTP 进程** 的前提下，用一条 Console 指令把路由扫成的契约**写成文件**，给 CI、SDK 或文档站用。路由怎么声明、`generateOpenapi` 怎么用，见 Web 侧 [OpenAPI 生成](/zh/plugins/openapi)。

```bash
pnpm add @aomex/openapi
```

在 `ConsoleApp` 的 mount 里挂上 `openapi({ routers, app, saveToFile, … })`，本地或流水线执行 `aomex openapi`，得到 `openapi.json`（或你指定的路径）。`app` 传与线上同一份 `WebApp`，全局中间件和 [envelope](/zh/web/envelope) 会一起进契约。

传入 `app` 时，请把 `new WebApp(...)` 与 `app.listen(...)` **拆开**（或只在入口 listen），否则 Console `import` Web 模块会副作用起服。

```typescript
// src/app.ts —— 只导出 WebApp，不 listen
import { formatError, routers, WebApp } from '@aomex/web';
import { services } from './services/index.js';

export const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [formatError({ /* … */ }), routers('./src/routers')],
});
```

```typescript
// src/cli.ts
import { openapi } from '@aomex/openapi';
import { commanders, ConsoleApp } from '@aomex/console';
import { app } from './app.js';

new ConsoleApp({
  services,
  logger: services.logger,
  language: 'zh-CN',
  mount: [
    openapi({ // [!code focus:18]
      routers: './src/routers',
      app, // [!code highlight]
      saveToFile: 'openapi.json',
      docs: {
        info: {
          title: 'My API',
          version: '1.0.0',
        },
      },
      fix: (doc) => {
        doc.servers = [{ url: 'https://api.example.com' }];
        return;
      },
    }),
    commanders('./src/commanders'),
  ],
});
```

```bash
npx aomex openapi
# 脚手架里常见：pnpm aomex openapi
```

成功后当前工作目录（或你配置的路径）会出现契约文件。

Console 这条链路主要是**批处理写文件**，不像 Web 路由那样收窄 ctx。业务路由上的 body / response 照旧在编译期收窄 action；落盘指令只是读同一套路由定义 + `app` 上的全局配置去生成 JSON。

::: warning
`saveToFile` 路径要和 CI 产物目录对齐，否则流水线找不到文件、下游 SDK 仍用旧契约。改路由或改 `app` 的 mount / envelope 后记得跑 `aomex openapi`，别让仓库里的契约文件漂着。
:::

## routers 与 app

落盘指令不会真的起 HTTP，但生成契约时要读**和线上一致**的路由目录，以及同一份 `WebApp`（鉴权、formatError、envelope 都从它来）。`routers` 指向与 Web 相同的 glob；漏传 `app` 时，文档里的 security、错误体、套壳形状容易和真实响应不一致。

| 选项 | 什么时候用 | 默认 |
| --- | --- | --- |
| `routers` | 必填；与 Web 扫路由同一 glob | — |
| `app` | 与线上同一 `WebApp` 实例 | — |
| `docs` | `info.title` / `version` / `description` | — |
| `fix` | 补 `servers`、联系人等文档级字段 | — |
| `saveToFile` | 落盘路径；CI 归档 | `openapi.json` |

CI 归档示例：

```typescript
import { app } from './app.js';

openapi({
  routers: './src/routers',
  app,
  saveToFile: 'artifacts/openapi.json', // [!code highlight]
  docs: {
    info: { title: 'My API', version: '1.0.0' },
  },
  fix: (doc) => {
    doc.servers = [{ url: 'https://api.example.com' }];
    return;
  },
});
```

## 落盘 vs 运行时吐 JSON

| 场景 | 做法 |
| --- | --- |
| CI 每次构建归档契约 | 本页：`openapi()` + `aomex openapi` |
| 改完路由本地更新文件 | 同上，手动跑一遍 |
| 运行时按请求吐最新 JSON | Web 路由调 `generateOpenapi({ routers, app })`，不必走 Console |

生成好的文件交给 [Swagger UI](/zh/plugins/swagger-ui) / [Redoc UI](/zh/plugins/redoc-ui)，或提交仓库做契约测试。

落盘和运行时动态吐 `/openapi.json` 不是一回事：高频在线扫描费 CPU，生产文档站多数用落盘 + 静态或 UI 插件读文件。

## 相关

- [OpenAPI 生成](/zh/plugins/openapi)
- [响应体套壳](/zh/web/envelope)
- [Swagger UI](/zh/plugins/swagger-ui)
- [Redoc UI](/zh/plugins/redoc-ui)
