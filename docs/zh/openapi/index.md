---
outline: deep
---

# 生成OpenAPI

在路由上**声明契约**，再扫成 OpenAPI 3.0：内存里给脚本 / Swagger 用，或经 Console **落盘**成文件给 CI、SDK。生成链路在 `@aomex/openapi-generator`；Swagger / Redoc 只是读这份 JSON 的方式。

没挂 query / body / response 的路由，文档里对应段也会空——运行时照样能跑，只是契约不完整。send / throw 的类型收窄见 [约束响应](/zh/web/response)。

```bash
pnpm add @aomex/openapi-generator
```

**传入与线上同一份 `WebApp` 实例**（`app`），生成器会读它的全局 `mount` 和 `envelope`，security、错误体、套壳才不容易和真环境漂开。

## 路由上挂 response 与 docs

契约来自路由上的声明：`query` / `body` / `params` 决定入参 schema，`response()` 写各状态码出口，`docs` 写 summary 与 tags。运行时校验与类型收窄和文档同源；漏挂的段在 openapi.json 里也会空着。

分组怎么打、默认文件名 tag 怎么覆盖见 [Tags 分组](/zh/openapi/tags)；`info.description` / 路由长说明里的 Markdown 见 [Markdown 文案](/zh/openapi/markdown)。

```typescript
// src/routers/user.ts
import { rule } from '@aomex/common';
import { query, response, Router } from '@aomex/web';

export const router = new Router({
  prefix: '/users',
  docs: { tags: ['User'] },
});

router.get('/', {
  docs: { summary: '用户列表' },
  mount: [query({ page: rule.int().min(1).default(1) })],
  action: async (ctx) => {
    ctx.send([]);
  },
});

router.get('/:id', { // [!code focus:14]
  docs: { summary: '用户详情' },
  mount: [
    response({ // [!code highlight]
      statusCode: 200,
      description: '找到用户',
      content: { id: rule.int(), name: rule.string() },
    }),
    response({ statusCode: 404, description: '不存在' }),
  ],
  action: async (ctx) => {
    // …
  },
});
```

## 传入 app 生成 Document

`generateOpenapi` 要的是 **`WebApp` 实例**，不再单独传一份 `mount` 数组。从 `app` 上读取全局中间件和 [响应体套壳](/zh/web/envelope)，作为 OpenAPI 注入的单一真源。

CLI、测试、脚本会 `import` 这份模块时，请把 `new WebApp(...)` 与 `app.listen(...)` **拆开**（或只在真正的进程入口 listen），否则一 import 就副作用起服、抢端口。

```typescript
// src/app.ts —— 只创建并导出，不 listen
import { formatError, routers, WebApp } from '@aomex/web';
import { rule } from '@aomex/common';
import { services } from './services/index.js';

export const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:12]
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

```typescript
// src/main.ts —— 进程入口才听端口
import { app } from './app.js';

app.listen(3000);
```

```typescript
import { writeFile } from 'node:fs/promises';
import { generateOpenapi } from '@aomex/openapi-generator';
import { app } from './app.js';

const document = await generateOpenapi({ // [!code focus:11]
  routers: './src/routers',
  app, // [!code highlight]
  docs: {
    info: { title: 'My API', version: '1.0.0' },
  },
  fix: (doc) => {
    doc.servers = [{ url: 'https://api.example.com' }];
    return;
  },
});

await writeFile('openapi.json', JSON.stringify(document, null, 2));
```

- 路由上挂 body / query / params 后，ctx.body、ctx.query 等在 action 里已是收窄后的类型——和文档 schema 同源。
- 挂 `response({ statusCode, content })` 后，`ctx.send(200, …)` 的第二个参数要对上 content；声明了 200 却 send(201) 通常会类型报错。
- 只用手写 `openapi.onMethod` 补某条响应时，**一般只影响生成的 JSON**，不会自动收窄 ctx.send——那种场景要自己盯类型。

`response()` 常用字段：

| 字段 | 什么时候用 |
| --- | --- |
| `statusCode` | 每个出口挂一次（200 / 201 / 204 / 404…） |
| `content` | JSON 成功体；顺带收窄 `ctx.send` |
| `contentType` | CSV、HTML、二进制等非默认 JSON |
| `headers` | 要文档化 `X-Request-Id` 等 |
| `example` | 文档站示例，不影响运行时 |

非 JSON 示例：

```typescript
response({
  statusCode: 200,
  contentType: 'text/csv', // [!code highlight]
  content: rule.string(),
  description: '导出 CSV',
});
```

验证器套不上的少数响应（二进制流等），可在该路由挂带 `openapi.onMethod` 的中间件，只改生成结果：

```typescript
import { middleware } from '@aomex/common';

export const openapiBinaryFile = middleware.web({ // [!code focus:18]
  fn: async (_ctx, next) => {
    return next();
  },
  openapi: {
    onMethod(methodItem) { // [!code highlight]
      methodItem.responses ||= {};
      methodItem.responses['200'] = {
        description: '文件流',
        content: {
          'application/octet-stream': {
            schema: { type: 'string', format: 'binary' },
          },
        },
      };
    },
  },
});
```

## generateOpenapi 选项与运行时出口

`generateOpenapi` 读路由目录，并从 `app` 取出全局 `mount` / `envelope`，在内存里拼出 OpenAPI Document；可写文件、挂进 Swagger/ReDoc，或给 CI diff。它**不启动 HTTP**，也不会自动收窄运行时 ctx——收窄仍靠路由上的 mount。

| `generateOpenapi` 选项 | 什么时候用 |
| --- | --- |
| `routers` | 必填；与 Web 扫路由同一 glob |
| `app` | 与线上同一 `WebApp` 实例（带出 mount、envelope） |
| `docs` | `info.title` / `version` / `description` |
| `fix` | 补 `servers`、联系人、厂商扩展；单条响应优先在路由上 `response()` |

运行时动态吐规范（自建 `/openapi.json`）：

```typescript
import { app } from '../app.js';

router.get('/openapi.json', {
  docs: { showInOpenapi: false },
  action: async (ctx) => {
    const document = await generateOpenapi({ // [!code highlight]
      routers: './src/routers',
      app,
    });
    ctx.send(document);
  },
});
```

每次请求都扫路由——访问频繁时可加缓存，或改下面的 Console 落盘 + 静态文件。

::: warning
`generateOpenapi` 的 `app` **必填**（类型上也是），并应与线上是**同一份配置**（同一实例最省事）。漏传过不了编译；传了另一套 mount / envelope 时，文档里的鉴权、formatError、套壳仍会和真环境对不上。
:::

## Console 落盘：`openapi()` + `aomex openapi`

不改 HTTP 进程、只要把契约**写成文件**时，在 `ConsoleApp` 的 mount 里挂 `openapi({ routers, app, saveToFile, … })`，再执行 `aomex openapi`。底层仍走同一套生成逻辑，只是批处理写盘。

```typescript
// src/cli.ts
import { openapi } from '@aomex/openapi-generator';
import { commanders, ConsoleApp } from '@aomex/console';
import { app } from './app.js';
import { services } from './services/index.js';

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

成功后当前工作目录（或你配置的路径）会出现契约文件。`routers` / `app` / `docs` / `fix` 含义与 `generateOpenapi` 相同；多出来的是 `saveToFile`（默认 `openapi.json`）。

::: tip
Console 落盘、脚本生成都会 `import` 你的 Web 模块：`new WebApp` 与 `app.listen` 拆开，避免 CLI 一跑就起 HTTP。
:::

::: warning
`saveToFile` 路径要和 CI 产物目录对齐，否则流水线找不到文件、下游 SDK 仍用旧契约。改路由或改 `app` 的 mount / envelope 后记得跑 `aomex openapi`，别让仓库里的契约文件漂着。
:::

CI 归档示例：

```typescript
openapi({
  routers: './src/routers',
  app,
  saveToFile: 'artifacts/openapi.json', // [!code highlight]
  docs: {
    info: { title: 'My API', version: '1.0.0' },
  },
});
```

| 场景 | 做法 |
| --- | --- |
| CI 每次构建归档契约 | `openapi()` + `aomex openapi` |
| 改完路由本地更新文件 | 同上，手动跑一遍 |
| 运行时按请求吐最新 JSON | Web 路由调 `generateOpenapi({ routers, app })` |
| 开发期点开试调 | 先看 [怎么选文档 UI](/zh/openapi/choose-ui)，再挂 [Swagger](/zh/openapi/swagger-ui) / [Redoc](/zh/openapi/redoc-ui) / [Scalar](/zh/openapi/scalar-ui) 读落盘或动态 `generateOpenapi` |

落盘和运行时动态吐 `/openapi.json` 不是一回事：高频在线扫描费 CPU，生产文档站多数用落盘 + 静态或 UI 插件读文件。

能挂在路由上的 response 尽量用 `response()` 维护，别只靠 fix 手改每一条。忘记 `docs.summary` / tags 时生成仍能用，对接方翻文档会痛苦——分组与文案分别见 [Tags](/zh/openapi/tags) · [Markdown](/zh/openapi/markdown)。提供 JSON 的那条路由通常设 `docs.showInOpenapi: false`，避免递归描述自己。

## 相关

- [Tags 分组](/zh/openapi/tags)
- [Markdown 文案](/zh/openapi/markdown)
- [约束响应](/zh/web/response)
- [响应体套壳](/zh/web/envelope)（传 `app` 时自动把成败支收成 200；`skipEnvelope` 的状态码原样保留）
- [错误格式](/zh/web/errors)
- [怎么选文档 UI](/zh/openapi/choose-ui) · [Swagger UI](/zh/openapi/swagger-ui) · [Redoc UI](/zh/openapi/redoc-ui) · [Scalar UI](/zh/openapi/scalar-ui)
