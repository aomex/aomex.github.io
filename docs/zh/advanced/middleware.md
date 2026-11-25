---
outline: deep
---

# 自定义中间件

[中间件](/zh/core/middleware) 里的 `middleware.mixin`、`.skip()`（支持函数或 `boolean`）、`dependsOn`（只借上游类型）够日常组合。到本页通常是因为：**运行时要做事，生成 OpenAPI / CLI 帮助时还要往契约里写一笔**——两件事写在同一个中间件里，改一处两边一起变。

下面按「先 Web 文档钩子 → 再 Console 帮助 → 最后跨舞台复用」往下做。跟着敲完，你会得到一个挂上就能影响 Swagger 的 trace 中间件。

## 先分清：mixin 还是 web / console

| 你要的效果 | 用哪个 |
| --- | --- |
| 只改运行时 `ctx`，文档不用管 | `middleware.mixin`（见 [中间件](/zh/core/middleware)） |
| Web：运行时 + 改 OpenAPI operation | `middleware.web({ fn, openapi })` |
| Console：运行时 + 贡献 `--help` 树 | `middleware.console({ fn, help })` |

`middleware.web` 的实例**不能**直接挂到 Console；反过来也不行。两边都要时，把公共逻辑抽成普通函数，再各包一层。

## 第一步：先写出能跑的运行时

目标：每条请求带上 `traceId`，下游 action 能读到。

```typescript
// src/middleware/trace-id.ts
import { middleware } from '@aomex/common';

export const traceId = middleware.web<{ // [!code highlight]
  readonly traceId: string;
}>({
  fn: async (ctx, next) => {
    ctx.traceId = crypto.randomUUID();
    await next();
  },
});
```

泛型 `{ readonly traceId: string }` 写在 `middleware.web` 上之后，**更后面的中间件和同路由 action** 里才会补全 `ctx.traceId`。只赋值、不写泛型，运行时有字段，TypeScript 仍当它不存在。

挂到应用或路由上试一下：

```typescript
import { routers, WebApp } from '@aomex/web';
import { traceId } from '@/middlewares/trace-id';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [
    traceId, // [!code highlight]
    routers('./src/routers'),
  ],
});
```

```typescript
import { logger } from '@/services/logger.service';

action: async (ctx) => {
  logger.info(`ok ${ctx.traceId}`);
  ctx.send({ ok: true });
};
```

这时 Swagger 里还不会出现 trace 相关说明——运行时和文档是分开注入的。

## 第二步：补上 OpenAPI 钩子

在同一个 `middleware.web` 参数对象里加 `openapi`。生成文档扫路由时，框架会调这些钩子，让你改当前 operation（或整份 document）。

常见入口（按类型提示选，不必全写）：

| 钩子 | 什么时候用 |
| --- | --- |
| `onMethod` | 给**当前这条** operation 加参数、响应、security |
| `postMethod` | 别人先写完再收尾（例如统一信封） |
| `onDocument` | 注册 `components.securitySchemes` 这类全局块 |

给每条挂了 `traceId` 的接口补一个响应头说明：

```typescript
import { middleware } from '@aomex/common';

export const traceId = middleware.web<{
  readonly traceId: string;
}>({
  fn: async (ctx, next) => {
    ctx.traceId = crypto.randomUUID();
    ctx.response.setHeader('X-Trace-Id', ctx.traceId);
    await next();
  },
  openapi: { // [!code focus:14]
    onMethod(methodItem) {
      methodItem.responses ||= {};
      const ok = methodItem.responses['200'];
      if (ok && typeof ok === 'object' && 'description' in ok) {
        ok.headers ||= {};
        ok.headers['X-Trace-Id'] = {
          schema: { type: 'string', format: 'uuid' },
          description: '请求追踪 ID',
        };
      }
    },
  },
});
```

重新跑 [生成OpenAPI](/zh/openapi/) 或打开 Swagger：挂了该中间件的 operation 上应能看到 `X-Trace-Id`。钩子里改错结构不会在 `pnpm start` 时报错，要在生成结果里核对。

::: tip
中间件若**运行时什么都不做**、只为改文档，先问自己能不能写在路由 `docs` 或生成器配置里——空跑一层会让 mount 更难读。
:::

## 第三步：Console 侧同样套路

指令要往 `--help` 里塞一段说明时，用 `middleware.console` + `help`：

```typescript
import { middleware } from '@aomex/common';

export const withDryRunFlag = middleware.console({ // [!code highlight]
  fn: async (ctx, next) => {
    await next();
  },
  help: {
    onDocument(doc) {
      // 按类型提示往帮助树贡献说明；具体字段以编辑器补全为准
    },
  },
});
```

挂在 `commander.create` 的 `mount` 上，和 Web 的 `openapi` 对称：一边是 HTTP 契约，一边是 CLI 帮助。

## 第四步：两边共用同一段逻辑

不要复制两份 UUID 逻辑。抽函数，再包：

```typescript
import { middleware } from '@aomex/common';

const assignTraceId = (ctx: { traceId: string }) => {
  ctx.traceId = crypto.randomUUID();
};

export const webTraceId = middleware.web<{ readonly traceId: string }>({
  fn: async (ctx, next) => {
    assignTraceId(ctx);
    await next();
  },
  openapi: {
    /* 同上 */
  },
});

export const consoleTraceId = middleware.console<{ readonly traceId: string }>({
  fn: async (ctx, next) => {
    assignTraceId(ctx);
    await next();
  },
});
```

## 配错时你会看到什么

| 现象 | 多半是 |
| --- | --- |
| action 里没有 `ctx.traceId` 补全 | `middleware.web` / `mixin` 漏了 Props 泛型 |
| 运行有 header，Swagger 没有 | 写了 `fn` 忘了 `openapi`，或生成时没扫到挂载该中间件的路由 |
| Console 挂了 `middleware.web` 类型报错 | 舞台不对，应换 `middleware.console` |
| 健康检查仍被鉴权挡 | 用 `.skip()`，见 [中间件 · skip](/zh/core/middleware#用-skip-绕过某类请求) |

## 相关

- 顺序、`.skip()`、`dependsOn`、ctx 合并：[中间件](/zh/core/middleware)
- 现成插件：[访问日志](/zh/plugins/access-log)、[统一入口 Auth](/zh/plugins/auth)
- 生成文档：[生成OpenAPI](/zh/openapi/)
