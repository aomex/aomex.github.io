# 中间件

给整站或某一组接口挂上「请求进来时做事、业务跑完还能收尾」的一层逻辑，并让下游 action 能用到你挂在 ctx 上的字段（比如 requestId）。

中间件就是一个函数：记得 await next()，请求才会继续往下走；你可以在调用 next 前后各写一段逻辑。

```typescript
import { middleware } from '@aomex/common';

export const withRequestId = middleware.mixin<{
  readonly requestId: string;
}>(async (ctx, next) => { // [!code highlight]
  ctx.requestId = crypto.randomUUID();
  await next();
});
```

::: warning
后面的中间件和业务都依赖 await next()；鉴权失败想截断可以不调，但别无意间漏调。务必 **await next()**，否则下游异步错误容易变成未处理的 Promise。
:::

用 `middleware.mixin<{ … }>` 声明你在 ctx 上新增的字段后，**更靠后的中间件和同一条路由的 action** 里，补全会出现这些属性；漏写泛型、只在运行时赋值，编译器仍会把它们当不存在。

```typescript
// action 里
async (ctx) => { // [!code highlight]
  await services.logger.info('请求', { requestId: ctx.requestId });
  return { ok: true };
};
```

多个中间件各自 mixin 的字段，类型上会合并到同一条 ctx 上。只运行时给 ctx 挂字段、不写 mixin 泛型能跑，但 TypeScript 帮不上忙，改名时容易漏改。

## WebApp.mount

`WebApp.mount` 是整站洋葱队列：CORS、访问日志、formatError、`routers(...)` 都按数组顺序执行。越靠前越外层，能在 `await next()` 前后包住后续全部路由。

```typescript
import { WebApp } from '@aomex/web';
import { routers } from '@aomex/web';
import { withRequestId } from './middlewares/request-id.js';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:2]
    withRequestId, // [!code highlight]
    routers('./src/routers'),
  ],
});
```

CORS、全站 requestId、访问日志等「每条请求都要」的事，放 `WebApp.mount` / `ConsoleApp.mount`。

## Router.mount

整组 URL 共享同一套逻辑（统一鉴权、审计、前缀下的 formatError）时用 `Router({ mount })`，只影响本文件注册的路径，不必用 WebApp 把整站都包一层。

```typescript
import { Router } from '@aomex/web';

// 某一组资源都要登录（auth 为项目里配好的 Auth 实例）
new Router({ prefix: '/admin', mount: [auth.authenticate('bearer')] });
```

某一类资源统一鉴权用 Router.mount；公开接口请拆另一个 Router（别在同一 Router 里到处 skip）。

## 单条路由 mount

单条路由的 `mount` 只在这条 action 前执行：本条独有的 body/query、更严 authorize、或和公开接口混在同一 Router 时的例外。日常校验优先用内置 query / body / cors / auth，不必每处都手写 middleware。

```typescript
import { rule } from '@aomex/common';
import { body } from '@aomex/web';

router.post('/login', { // [!code focus:11]
  mount: [
    body({ // [!code highlight]
      email: rule.email(),
      password: rule.string(),
    }),
  ],
  action: async (ctx) => {
    ctx.send({ token: '...' });
  },
});
```

## 用 skip 绕过某类请求

少数路径或环境不想跑整条中间件（健康检查免鉴权、测试环境关掉某层），在已有中间件上链式 `.skip(...)`：条件为 `true` 时直接 `next()`，不执行原逻辑——比复制一份 `mount` 少维护。

可以传**函数**（按请求动态判断），也可以直接传 **`boolean`**（编译期就能定死要不要跳）：

```typescript
const authMaybe = auth.authenticate('bearer').skip((ctx) => { // [!code highlight]
  return ctx.request.pathname === '/health';
});

// 测试环境整层关掉：不必再包一层函数
const accessLogMaybe = accessLog().skip(process.env['NODE_ENV'] === 'test');

// 临时禁用某层（等价于挂 mount 时先拿掉）
someMiddleware.skip(true);
```

::: warning
`.skip()` **不会**改 Props 类型：跳过鉴权时，`ctx.auth` 在类型上仍像「有」；action 里要自己处理未登录分支。公开接口多时，更推荐拆「无鉴权 Router」，别给鉴权链挂一排 skip。
:::

## 用 dependsOn 借用上游类型

写中间件时，如果**假定**前面已经挂过某层（例如鉴权、带 `userId` 的中间件），希望在 `fn` 里直接补全那些字段，但不想把上游再执行一遍——用 `middleware.dependsOn(上游).web(...)` / `.mixin(...)` / `.console(...)`。

`dependsOn` **只参与类型**：运行时不会调用你传入的中间件；真正执行仍靠 mount 顺序里前面那一层。

```typescript
import { middleware } from '@aomex/common';

const withUser = middleware.web<{ userId: number }>(async (ctx, next) => {
  ctx.userId = Number(ctx.request.headers['x-user-id']);
  await next();
});

// 假定上游已挂 withUser：这里能补全 ctx.userId，但不会再跑一遍 withUser
export const loadProfile = middleware.dependsOn(withUser).web(async (ctx, next) => { // [!code highlight]
  const profile = await services.user.getProfile(ctx.userId);
  ctx.send(profile);
  await next();
});
```

挂载时仍要把上游放在前面：

```typescript
router.get('/me', {
  mount: [withUser, loadProfile], // [!code highlight]
  action: async () => {},
});
```

也可以传工厂 / `async` 工厂（和 `combineServices` 懒加载类似，这里同样只为类型服务）。可链式多次 `dependsOn`，字段会叠在一起。

::: tip
`Middleware.Infer<typeof loadProfile>` **不会**带上 `dependsOn` 借来的 Props——对外仍像「自己没往 ctx 上加字段」。借类型只影响你在 `fn`（以及紧跟着的一次 `.skip(ctx => …)`）里看到的 `ctx`。
:::

日常优先用现成的 query、body、cors、各类 auth；要往 OpenAPI / CLI 帮助里写钩子，见 [自定义中间件](/zh/advanced/middleware)。

## 下一步

- 校验与 400 文案：[请求实体](/zh/web/body)、[查询字符串](/zh/web/query)
- 鉴权中间件：[统一入口 Auth](/zh/plugins/auth)
- OpenAPI / Help 钩子：[自定义中间件](/zh/advanced/middleware)
