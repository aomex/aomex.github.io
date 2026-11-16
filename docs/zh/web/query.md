---
outline: deep
---

# 查询字符串

给 GET（或带 query 的其它动词）接口声明 ?page=1&keyword= 这类参数：在路由 mount 里挂 query()，用 [验证器](/zh/validators/) 约束类型和范围。过关后业务里直接用 ctx.query；不过关自动 **400**，不进 action。

```typescript
import { rule } from '@aomex/common';
import { query, Router } from '@aomex/web';

export const router = new Router();

router.get('/users', { // [!code focus:13]
  mount: [
    query({ // [!code highlight]
      page: rule.int().min(1).default(1),
      size: rule.int().min(5).max(50).default(10),
      keyword: rule.string().optional(),
    }),
  ],
  action: async (ctx) => {
    const { page, size, keyword } = ctx.query;
    ctx.send({ page, size, keyword, items: [] });
  },
});
```

请求示例：GET /users?page=2&size=20&keyword=ada。

挂了 query() 后，ctx.query 只含声明过的键；default() 让缺省参数在类型上是必填的数值/字符串（例如 page 始终是 number）。optional() 的字段类型带 undefined。没在 mount 里挂 query() 时，只有 `ctx.request.query` 之类较宽的类型——业务里别直接当可信数据用。校验失败不进 action，响应 **400**。

别在 action 里手写 `Number(ctx.request.query.page)`——和 OpenAPI、校验错误格式脱节，类型也不会自动收窄。

## 复用列表 schema

多个列表接口共用 `page` / `size` / `q` 时，把 query 字段收到 `src/schemas/*.schema.ts`，路由里 `query(listQuerySchema)` 引用同一份。改分页上限或默认值只动一处，OpenAPI 也会跟着同一套描述走。

多个列表接口共用分页 / q 搜索时，抽到 `src/schemas/*.schema.ts`：

```typescript
// src/schemas/list-query.schema.ts
import { schema, rule } from '@aomex/common';

export const listQuerySchema = schema({
  page: rule.int().min(1).default(1),
  size: rule.int().max(100).default(20),
  q: rule.string().trim().optional(),
});
```

```typescript
// src/routers/user.ts
import { query, Router } from '@aomex/web';
import { listQuerySchema } from '../schemas/list-query.schema.js';

const router = new Router();

router.get('/users', { // [!code focus:6]
  mount: [query(listQuerySchema)], // [!code highlight]
  action: async (ctx) => {
    const { page, size, q } = ctx.query;
    ctx.send(await searchUsers({ page, size, q }));
  },
});
```

枚举排序字段：

```typescript
sort: rule.enum(['name', 'createdAt'] as const).default('createdAt'),
```

OpenAPI 说明挂在 rule 或路由上：

```typescript
page: rule.int().min(1).docs({ description: '页码，从 1 起' }),
```

## 与 body / params 分工

三种入参来源别混用职责：**query** 做筛选和分页（幂等 GET），**params** 标识路径里的资源，**body** 承载创建/更新的实体。搞错位置会导致缓存、日志和 OpenAPI 都跟真实语义不一致。

| 来源 | 典型用途 |
| --- | --- |
| **query** | 过滤、分页、排序——幂等 GET |
| **params** | 路径里的资源 ID |
| **body** | POST / PUT / PATCH 的实体 |

大段 JSON 过滤若硬塞 query，URL 会爆、缓存键难管——这类可改 POST + `body()`，接受不能当幂等 GET 缓存的代价。POST 创建却用 query 传大 JSON 同样违背惯例。

::: tip
列表页客户端常多传跟踪参数；query 别开得过于 strict 或多余必填，否则 B2B 对接很容易 400。default() 让类型上有默认值，但访问日志里的原始 URL 未必带 ?page=1。
:::

## 下一步

- [路径参数](/zh/web/params)
- [请求实体](/zh/web/body)
- [验证器链式方法](/zh/validators/chain)：default、optional、transform
