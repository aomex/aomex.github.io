---
outline: deep
---

# 快速安装

从零拉起一个能跑的 aomex 项目：HTTP 能访问，终端也能跑指令。脚手架把 logger / language / 关停等必填项带好，比空手搭省事。

```bash
npx create-aomex@latest
cd your-project
pnpm install
pnpm start
```

::: tip 环境
**Node.js ≥ 24**（先 node -v）。包管理器用 **pnpm** 最省心；npm / yarn 一般也能用。
:::

起来之后浏览器打一下健康检查或首页（端口看模板的 PORT）。终端侧：

```bash
pnpm aomex -h
```

## 目录结构

脚手架大概长这样（版本不同会微调）。先抓住三条线：`src/web.ts` 起 HTTP，`src/cli.ts` 起终端 / Cron / OpenAPI 落盘，`src/routers/` 与 `src/commanders/` 各写接口与指令；鉴权、错误格式、访问日志等可复用中间件放 `src/middleware/`，查库、缓存放进 `src/services/`，**两边共用**。

| 文件 / 目录 | 你改它做什么 |
| --- | --- |
| `src/web.ts` | 起 HTTP |
| `src/cli.ts` | 起终端指令 / Cron / 落盘 OpenAPI |
| `src/routers/` | 写接口 |
| `src/commanders/` | 写 CLI 指令 |
| `src/middleware/` | 鉴权、formatError、访问日志、Swagger 等可复用中间件，再挂到 `web.ts` / 路由 mount |
| `src/services/` | 查库、缓存、发邮件——业务 SQL 别塞进路由 `action` |
| `src/schemas/` | 可复用校验，文件名 `xxx.schema.ts`（OpenAPI 与 CLI 共用同一份） |

用不到的（prisma、i18n…）删掉即可，不必留着装门面。CORS、鉴权、OpenAPI 等是独立包，用到再装。

## 改一条接口试试

脚手架里已有 `src/routers/`。新文件 `export const router = new Router()`，`routers('./src/routers')` 会扫进去。先验再进 action：

```typescript
// src/routers/hello.router.ts
import { rule } from '@aomex/common';
import { query, Router } from '@aomex/web';

export const router = new Router();

router.get('/hello', {
  mount: [
    query({ name: rule.string().default('world') }), // [!code highlight]
  ],
  action: async (ctx) => {
    ctx.send({ message: `hello, ${ctx.query.name}` });
  },
});
```

`pnpm start` 后访问 `/hello?name=ada`，这时 `ctx.query.name` 已是 string。

## 跑一条指令试试

Console 与 Web **共用** services / schemas。改 `src/commanders/` 里的指令，或直接跑脚手架自带的：

```bash
pnpm aomex hello
pnpm aomex hello --user Ada
```

定时任务、OpenAPI 落盘也走 `src/cli.ts`，见 [Cron](/zh/plugins/cron) · [生成OpenAPI](/zh/openapi/)。

## 下一步

1. [Web 应用入口](/zh/web/) — `WebApp` 必填项、language、关停  
2. [接口路由](/zh/web/router) — mount、docs、disabled  
3. [验证器](/zh/validators/) — 字段怎么验、类型怎么收窄  
4. [服务层](/zh/core/service) — 查库、缓存往哪儿放  
5. [Console 应用入口](/zh/console/) — 指令与 Cron
