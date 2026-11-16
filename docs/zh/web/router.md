---
outline: deep
---

# 接口路由

在 `src/routers` 里按领域拆文件，每个文件导出一个 Router，用 get / post 注册 action；在 WebApp 的 mount 里用 `routers('./src/routers')` 一次性挂上。

```typescript
// src/routers/user.ts
import { Router } from '@aomex/web';

export const router = new Router();

const users = [
  { id: 1, name: 'Ada' },
  { id: 2, name: 'Bob' },
];

router.get('/users', { // [!code focus:5]
  action: async (ctx) => {
    ctx.send(users);
  },
});

router.get('/users/count', {
  action: async (ctx) => {
    ctx.send({ count: users.length });
  },
});
```

挂到应用：

```typescript
import { routers, WebApp } from '@aomex/web';

new WebApp({
  // services、logger、language、proxyIP …
  mount: [routers('./src/routers')], // [!code highlight]
});
```

测试或特性开关时，可传具体实例，不必扫目录：

```typescript
import { userRouter } from './routers/user.js';
import { postRouter } from './routers/post.js';

mount: [routers([userRouter, postRouter])],
```

单条路由的 mount 里挂了 query() / body() / params() / response() 后，action 里的 ctx 会合并对应字段类型。**方法级** mount 只影响当前接口；**路由级** `Router({ mount: [...] })` 对该文件内所有方法生效。

```typescript
router.get('/users', { // [!code focus:11]
  mount: [
    middleware.web<{ tenant: string }>(async (ctx, next) => { // [!code highlight]
      ctx.tenant = ctx.request.headers['x-tenant'] as string;
      await next();
    }),
  ],
  action: (ctx) => {
    ctx.tenant;
  },
});

router.get('/users/:id', {
  action: (ctx) => {
    ctx.tenant; // 类型上不存在
  },
});
```

## prefix

`Router({ prefix })` 给本文件里**所有**注册路径加一段固定前缀，避免每条 `router.get` 都手写 `/users`。版本切换（`/v1` → `/v2`）或按域拆 URL 时只改构造参数一处即可。

```typescript
import { rule } from '@aomex/common';
import { params, Router } from '@aomex/web';

export const router = new Router({ prefix: '/users' }); // [!code highlight]

router.get('/', { // [!code focus:5]
  action: async (ctx) => {
    ctx.send([]);
  },
});

router.get('/:id', {
  mount: [params({ id: rule.int().min(1) })],
  action: async (ctx) => {
    ctx.send({ id: ctx.params.id });
  },
});
```

最终路径 = prefix + 注册时的 uri（多余斜杠会归一）。联调 404 时别只看 `router.get('/:id')`，要先拼上 prefix 全路径。

OpenAPI 按域分组用 `Router({ docs: { tags: ['User'] } })`；单路由 `docs.summary` 可覆盖。

## 路由级 mount

路由级 `Router({ mount: [...] })` 把中间件挂在整个文件的所有方法上：整组都要登录、记审计、或统一挂 query 默认值时用这个入口，比在每个 `router.get` 里重复 mount 省事。

整文件都要登录、审计时：

```typescript
new Router({
  prefix: '/admin',
  mount: [auth.authenticate('bearer')],
});
```

路由级 mount 对该文件内**所有**方法生效；公开接口和要登录的接口别挤在同一 Router 里——公开页拆文件，或改方法级 mount / skip。

## 单条路由 mount、docs、disabled

**方法级 mount** 只作用于这一条路由：入参校验（query / body / params / response）、单接口鉴权等。和路由级 mount 叠在一起时，先走路由级，再进方法级。

**disabled** 让某条路由在运行时**不注册**（匹配不到、不会进 action）。常用环境变量或特性开关关掉半成品接口，比在生产里留 501 更安全。

**docs** 写这条路由在 OpenAPI 里的说明（如 `summary`）。`Router({ docs: { tags } })` 负责分组；单路由 docs 可覆盖标题和描述，生成文档时和 [response()](/zh/web/response) 一起被扫进契约。

```typescript
import { rule } from '@aomex/common';
import { query, response, Router } from '@aomex/web';

router.get('/users', { // [!code focus:11]
  disabled: process.env['FEATURE_USERS'] !== '1', // [!code highlight]
  mount: [
    query({ page: rule.int().min(1).default(1) }),
    response({ statusCode: 200, content: rule.array({ id: rule.int() }) }),
  ],
  docs: { summary: '用户列表' }, // [!code highlight]
  action: async (ctx) => {
    ctx.send([]);
  },
});
```

OpenAPI 元数据详见 [OpenAPI 插件](/zh/plugins/openapi)。

单条路径参数：

```typescript
router.get('/users/:id', {
  mount: [params({ id: rule.int().min(1) })], // [!code highlight]
  action: async (ctx) => {
    ctx.send({ id: ctx.params.id });
  },
});
```

路径参数不挂 params() 时，`ctx.request.params` 全是字符串，"1" 和 1 在业务里容易混。

## HTTP 方法

每个 `router.<method>(uri, { ... })` 绑定一种 HTTP 动词；登记顺序不影响匹配，静态段和字面量路径仍优先于 `:param`。

| 方法 | 说明 |
| --- | --- |
| `get` | `GET`；**HEAD** 与同名 `GET` 共享匹配 |
| `post` / `put` / `patch` / `delete` | 对应动词 |
| `all` | 上述全部动词 |
| `customize` | 自选动词数组 |

`customize` 在同一路径上同时接受多种动词（GET 校验、POST 回执等），标准 `get` / `post` 各注册一遍会占两条路由、也不好维护。第三方 webhook、健康检查兼探测时常用它：

第三方 webhook 用 customize：

```typescript
router.customize(['GET', 'POST'], '/webhook', { // [!code highlight]
  action: async (ctx) => {
    ctx.send({ ok: true });
  },
});
```

## 路径写法

注册 uri 时，**字面量段**优先于 `:param`，所以 `/users/count` 不会被 `/:id` 吃掉。命名参数键名要和 `params()` 里的字段一致。

| 写法 | 含义 |
| --- | --- |
| `/users/:id` | 命名参数 `id` |
| `/users/count` 与 `/users/:id` 并存 | 字面量路径优先，`:id` 不会吃掉 `count`；别指望注册顺序救场，能写静态段就写静态段 |

glob 扫目录时尽量只放 Router 导出，杂文件多了难排查「为什么没注册上」。

## 下一步

- [Web 应用入口](/zh/web/)：WebApp 与全站 mount
- [查询字符串](/zh/web/query)：GET 筛选与分页
- [路径参数](/zh/web/params)、[请求实体](/zh/web/body)
