---
outline: deep
---

# 约束响应

给一条路由声明「可能返回哪些状态码、成功体长什么样」：在 mount 里挂 response()。不改变世界怎么发数据，但会收窄 ctx.send / ctx.throw / ctx.redirect 的类型，并写进 OpenAPI。声明了 200 却 send(201)，编译器会红——这是刻意的。

```typescript
import { rule } from '@aomex/common';
import { response, Router } from '@aomex/web';

export const router = new Router();

router.get('/me', { // [!code focus:19]
  mount: [
    response({ // [!code highlight]
      statusCode: 200,
      content: {
        id: rule.int(),
        name: rule.string(),
      },
    }),
    response({ statusCode: 404 }),
  ],
  action: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) {
      return ctx.throw(404, 'not found');
    }
    ctx.send({ id: user.id, name: user.name });
  },
});
```

缺资源用 throw(404)，成功用 send——别混成 send(404)。response() 约束的是编译期和文档，**不会**在运行时再验一遍 send 的 body。

挂了 200 的 content 后，ctx.send({ id, name }) 必须与验证器推断一致。声明了 `response({ statusCode: 404 })` 后，ctx.throw(404, …) 才「合法出口」。**201**、其它非 200 的 2xx 要在 send 里**显式写状态码**；**204** 用 ctx.send(204)，不要再塞 {}。**3xx** 走 ctx.redirect(status, url)。可以多次挂 response()，分别写成功态和错误态。

| 状态码 | 常见做法是怎么发 |
| --- | --- |
| `200` | `send(body)` 或 `send(200, body)` |
| 其它 2xx | `send(status, body)` |
| 204 等无 body | `send(status)` |
| 3xx | `redirect(status, url)` |
| 4xx / 5xx | `throw(status, …)` |

## 创建资源 201

REST 里「新建成功」常用 **201**，body 里带新资源的 id 等字段。在 mount 里声明 `response({ statusCode: 201, content: ... })`，action 里用 `ctx.send(201, body)`，类型和 OpenAPI 才会把 201 当成合法出口。

```typescript
import { body } from '@aomex/web';

router.post('/users', { // [!code focus:15]
  mount: [
    body({
      name: rule.string().trim().length({ min: 1 }),
    }),
    response({ // [!code highlight]
      statusCode: 201,
      content: { id: rule.int(), name: rule.string() },
    }),
    response({ statusCode: 400 }),
  ],
  action: async (ctx) => {
    const user = await createUser(ctx.body);
    ctx.send(201, { id: user.id, name: user.name });
  },
});
```

## 删除成功 204

删除成功且**不需要返回 JSON** 时用 **204 No Content**。声明 `response({ statusCode: 204 })` 后，`ctx.send(204)` 才是收窄后的正确写法；别在 204 里再塞 `{}`。

```typescript
import { params } from '@aomex/web';

router.delete('/users/:id', {
  mount: [
    params({ id: rule.int().min(1) }),
    response({ statusCode: 204 }), // [!code highlight]
    response({ statusCode: 404 }),
  ],
  action: async (ctx) => {
    const ok = await deleteUser(ctx.params.id);
    if (!ok) {
      return ctx.throw(404);
    }
    ctx.send(204);
  },
});
```

## 重定向 3xx

短链、登录后跳转、旧 URL 迁到新域名时走 **3xx**，业务里用 `ctx.redirect(status, url)` 而不是手写 Location。在 mount 里挂上对应 `response({ statusCode: 302 })`（或其它 3xx），类型里才会把 redirect 算进合法出口。

```typescript
router.get('/go', {
  mount: [
    response({ statusCode: 302 }), // [!code highlight]
  ],
  action: async (ctx) => {
    ctx.redirect(302, 'https://example.com');
  },
});
```

## 分页列表信封

列表接口常在 200 里返回 `{ total, items }` 这类固定信封，而不是裸数组。用 `response({ statusCode: 200, content: { total, items: rule.array(...) } })` 和 [query()](/zh/web/query) 对齐分页入参，前端和 OpenAPI 都能看到同一形状。

```typescript
import { query } from '@aomex/web';

router.get('/users', { // [!code focus:22]
  mount: [
    query({
      page: rule.int().min(1).default(1),
      size: rule.int().min(1).max(50).default(20),
    }),
    response({ // [!code highlight]
      statusCode: 200,
      content: {
        total: rule.int(),
        items: rule.array({
          id: rule.int(),
          name: rule.string(),
        }),
      },
    }),
  ],
  action: async (ctx) => {
    const { page, size } = ctx.query;
    const { total, items } = await listUsers({ page, size });
    ctx.send({ total, items });
  },
});
```

只挂校验类 400、不写字段形状时，正文常跟全局 formatError 对齐：

```typescript
response({ statusCode: 400 }),
```

SSE、纯文本等特殊媒体类型：

```typescript
response({
  statusCode: 200,
  contentType: 'text/event-stream', // [!code highlight]
  content: rule.string(),
}),
```

## 跳过响应套壳

全站配了 [envelope](/zh/web/envelope) 时，某个状态码仍要**裸写出**，在对应 `response()` 上加 `skipEnvelope: true`。只影响本条的 `statusCode`；同路由其它状态码照常套壳。运行时与 OpenAPI 一起登记。

```typescript
router.get('/report.pdf', { // [!code focus:12]
  mount: [
    response({
      statusCode: 200,
      contentType: 'application/pdf',
      content: rule.string(),
      skipEnvelope: true, // [!code highlight]
    }),
    response({ statusCode: 404 }),
  ],
  action: async (ctx) => {
    ctx.send(await loadPdf());
  },
});
```

文档页、裸 OpenAPI JSON 这类基础设施出口，也可在 action 里设 `ctx.response.skipEnvelope = true`（无条件跳过本次）。业务路由优先用上面的选项，避免文档漏记。

不挂 response() 也能 ctx.send；上线前补上成功态和常见的 400/404，避免 OpenAPI 和类型里响应是空洞。声明 200 却在 action 里 `send(201)` 会直接类型报错——改状态码或改 response() 声明。

## 下一步

- [错误格式](/zh/web/errors)（4xx/5xx JSON 与 response 配合）
- [响应体套壳](/zh/web/envelope)（外层固定 200、body 统一外壳；`skipEnvelope`）
- [请求实体](/zh/web/body) / [查询参数](/zh/web/query)（入参侧对称写法）
- [OpenAPI 文档生成](/zh/openapi/)