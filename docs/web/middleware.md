# 内置的中间件

接口总是要接口客户端传递的参数，外部传入的参数属于`不可信任`的参数，因为黑客和无聊的人可以模拟客户端调用你的接口。我们需要找个合适的位置过滤参数，但最好不要在控制器里做这些事，否则会显得逻辑很乱

```typescript
// 错误示范
router.get('/users', {
  action(ctx) {
    const page = ctx.request.query.page
      ? Math.max(1, Number.parseInt(ctx.body.page) || 1)
      : 1;
    const pageSize = ctx.request.query.pageSize
      ? Math.min(50, Math.max(5, Number.parseInt(ctx.body.pageSize))) || 10
      : 10;
    // ...逻辑
    ctx.send(users);
  },
});
```

这种写法应该不是个例，新手以及不使用框架的开发者及其容易使用这种方式过滤参数。写法重复、琐碎、容易缺失判断场景、没有类型提示、不易维护。可以说是百害无一利！

接下来我们聊聊如何正确过滤参数。

## query

**说明：** 过滤查询字符串上的参数

```typescript
import { rule } from '@aomex/core';
import { query } from '@aomex/web';
import { Router } from '@aomex/router';

export const router = new Router();

router.get('/users', {
  mount: [
    query({
      page: rule.int().min(1).default(1),
      pageSize: rule.int().min(5).max(50).default(10),
    }),
  ],
  /**
   * ctx类型自动推导：
   * query: { page: number; pageSize: number; }
   */
  action(ctx) {
    const { page, pageSize } = ctx.query;
    // ...逻辑
    ctx.send(users);
  },
});
```

高下立判。通过中间件和验证器的结合，`可读性好`、`逻辑简洁`、`类型推导`、`包含swagger文档`，`规则可抽取复用`，简直不要太爽

## body

**说明：** 过滤请求体的参数，支持表单、JSON、XML

```typescript
import { rule } from '@aomex/core';
import { body } from '@aomex/web';
import { Router } from '@aomex/router';

export const router = new Router();

router.post('/users', {
  mount: [
    body({
      username: rule.string().trim().docs({ description: '真实姓名' }),
      nickname: rule.string().docs({ description: '昵称' }),
      age: rule.int().min(1).optional(),
      address: rule.string().optional(),
    }),
  ],
  /**
   * ctx类型自动推导：
   * body: {
   *   username: string;
   *   nickname: string;
   *   age: number | undefined;
   *   address: string | undefined;
   * }
   */
  async action(ctx) {
    await logic.createUser(ctx.body);
    ctx.send(201);
  },
});
```

> 不在验证范围的数据会被抛弃以保证安全

## params

**说明：** 过滤路径参数

```typescript
import { rule } from '@aomex/core';
import { params } from '@aomex/web';
import { Router } from '@aomex/router';

export const router = new Router();

router.get('/users/:id', {
  mount: [
    params({
      id: rule.int(),
    }),
  ],
  /**
   * ctx类型自动推导：
   * params: { id: number }
   */
  action(ctx) {
    const user = logic.getUser(ctx.params.id);
    ctx.send(user);
  },
});
```

## response

**说明：** 过滤响应数据，同时用于生成openapi/swagger文档

```typescript
import { rule } from '@aomex/core';
import { response } from '@aomex/web';
import { Router } from '@aomex/router';

export const router = new Router();

router.get('/users', {
  mount: [
    response({
      statusCode: 200,
      contentType: 'json',
      schema: rule.array({
        id: rule.int(),
        username: rule.string(),
        nickname: rule.string(),
        // 通常从数据库中取出的是null而不是undefined
        age: rule.int().nullable(),
        address: rule.int().nullable(),
      }),
    }),
  ],
  action(ctx) {
    const user = logic.getUser(ctx.params.id);
    ctx.send(user);
  },
});
```

在debug模式下，我们会执行验证程序以保证接口文档的准确性，验证失败时使用500状态码。如果你不想验证，可以关掉它<small>（不推荐）</small>

```typescript
// 关闭单个响应的验证功能。优先级：高
response({
  validate: false,
});

// 关闭所有响应的验证功能。优先级：中
const app = new WebApp({
  validateResponse: false,
});

// 关闭debug模式，从而关闭所有响应的验证功能。优先级：低
const app = new WebApp({
  debug: false,
});
```

> 判断顺序: response.validate ?? app.validateResponse ?? app.debug
