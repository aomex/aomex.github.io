---
outline: deep
---

# 路径参数

路由写成 /users/:id 这类模板后，匹配到的段会先以**字符串**躺在 `ctx.request.params` 里。用 mount 里的 params() 做类型和范围校验，业务里用干净的 ctx.params；形态不合法 **400**，查无此人再 **404**。

```typescript
import { rule } from '@aomex/common';
import { params, Router } from '@aomex/web';

export const router = new Router();

router.get('/users/:id', { // [!code focus:15]
  mount: [
    params({ // [!code highlight]
      id: rule.int().min(1),
    }),
  ],
  action: async (ctx) => {
    const { id } = ctx.params;
    const user = await findUser(id);
    if (!user) {
      ctx.throw(404, 'user not found');
    }
    ctx.send(user);
  },
});
```

:id 能匹配任意字符串不代表合法 ID——范围、UUID 交给验证器；形态错用 **400**，查无此人再用 **404**，否则监控会把笔误当成资源缺失。

`params({ id: rule.int().min(1) })` 之后，ctx.params.id 是 number。路由模板 :userId 与 schema 键 userId 必须一致。没挂 params() 时只有字符串——"42" 和 42 在业务判断里容易混。路径根本没匹配到路由时，不会执行 params()，那是 404 的事，不是校验 400。

路由写 :userId 却 `params({ id: ... })` 会对不上键名；也别用 query 重复传一份 id 并以 query 为准——路径和 query 不一致时缓存、权限、日志都会乱。

## UUID 与多段路径

对外 ID 是 UUID 时用 `rule.uuid()`，避免把任意字符串当成合法主键。路径里有多段占位（`/users/:userId/posts/:postId`）时，在**同一个** `params({ ... })` 里声明所有键，键名必须和路由模板一致。

对外暴露 UUID 的资源：

```typescript
params({ id: rule.uuid() }),
```

```typescript
router.get('/users/:userId/posts/:postId', { // [!code focus:12]
  mount: [
    params({ // [!code highlight]
      userId: rule.int().min(1),
      postId: rule.int().min(1),
    }),
  ],
  action: async (ctx) => {
    const { userId, postId } = ctx.params;
    ctx.send({ userId, postId });
  },
});
```

## 复用 param schema

`:id` 在多个路由里重复出现时，把 `params` 形状抽到 schema 文件，和 [body / query 复用](/zh/web/body) 同一套路。改 ID 规则（int → uuid）时只改 schema 一处。

```typescript
// src/schemas/user-id-param.schema.ts
import { schema, rule } from '@aomex/common';

export const userIdParamSchema = schema({
  id: rule.uuid(),
});
```

```typescript
import { params } from '@aomex/web';
import { userIdParamSchema } from '../schemas/user-id-param.schema.js';

router.get('/users/:id', { // [!code focus:5]
  mount: [params(userIdParamSchema)], // [!code highlight]
  action: async (ctx) => {
    ctx.send(await findUser(ctx.params.id));
  },
});
```

挂 params() 后 OpenAPI 里 path 参数自动 in: path 且 required。

## 下一步

- [查询字符串](/zh/web/query)
- [请求实体](/zh/web/body)
- [接口路由](/zh/web/router)：静态路径与 :id 并存