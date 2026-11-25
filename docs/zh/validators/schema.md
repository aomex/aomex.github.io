---
outline: deep
---

# schema

把「用户、订单、分页」这类字段表收成一份可复用单元，放到 `src/schemas/xxx.schema.ts`，路由上 body(schema) / query(schema)，测试里 `validate(input, schema)`——同一套规则、同一套 `Validator.Infer` 类型，少复制粘贴。

```typescript
// src/schemas/user.schema.ts
import { schema, rule, type Validator } from '@aomex/common';

export const userSchema = schema({ // [!code highlight]
  id: rule.int(),
  name: rule.string().trim().length({ min: 1 }),
  email: rule.email(),
  password: rule.string().length({ min: 8 }),
});

export type User = Validator.Infer<typeof userSchema>;
```

```typescript
// src/routers/users.ts
import { body, Router } from '@aomex/web';
import { userSchema } from '@/schemas/user.schema';

export const router = new Router();

router.post('/register', {
  mount: [body(userSchema.omit('id'))], // [!code highlight]
  action: async (ctx) => {
    await register(ctx.body);
    ctx.send(201);
  },
});
```

字段上的 optional / default 等仍是 [通用链式](./chain)；下面主要是 **schema 自己身上**的方法。

- `Validator.Infer<typeof userSchema>` 就是校验通过后的对象类型，和 ctx.body 窄化后应对齐。
- pick / omit / extend 会产出**新** schema，类型也是新的一份；OpenAPI 组件名不会自动继承，要进组件库就各自再 asName(...)。
- partial() 后各字段变可选；无参 partial() 若 schema 里有人挂了 transform，类型上可能直接不让你调——改用具名 partial('name', 'bio')。
- required() 反向收紧；字段上已有 default 的，收紧后缺省仍走默认。

| 方法 | 什么时候用 |
| --- | --- |
| `schema({ ... })` | 第一次收成单元 |
| `asName('User')` | OpenAPI `components.schemas` 里要 `$ref` |
| `pick('email', 'password')` | 登录只要两字段 |
| `omit('password')` | 对外 DTO、注册不让传 `id` |
| `extend({ nickname: rule.string() })` | 注册在账号基础上加字段 |
| `partial()` / `partial('name')` | PATCH、`PATCH` 草稿 |
| `required()` / `required('name')` | 草稿变正式提交 |

### asName(name)

名称**不会**自动传到后面的 pick / omit / extend / partial / required 结果——每个要进组件库的形状自己再点一次。

```typescript
export const userSchema = schema({
  id: rule.int(),
  name: rule.string(),
  password: rule.string(),
}).asName('User'); // [!code highlight]

export const publicUserSchema = userSchema.omit('password').asName('PublicUser');
```

### pick / omit

```typescript
import { userSchema } from '@/schemas/user.schema';

userSchema.pick('email', 'password');
userSchema.omit('password');
```

注册接口若直接 body(userSchema) 却忘了 omit('id')，客户端不该改主键——创建 schema 单独派生一份。

### extend

同名以传入为准；可传字段表，也可传另一个 schema。

```typescript
export const accountSchema = schema({
  email: rule.email(),
  password: rule.string().length({ min: 8, max: 128 }),
}).asName('Account');

export const registerSchema = accountSchema.extend({ // [!code highlight]
  nickname: rule.string().trim().length({ min: 1, max: 32 }),
});
```

改了 extend 后若忘了给新形状 asName，OpenAPI 里仍是内联一坨，不利于 $ref。

### partial / required

```typescript
import { userSchema } from '@/schemas/user.schema';

userSchema.pick('name', 'email', 'bio').partial(); // [!code highlight]

const draftSchema = userSchema.partial();
draftSchema.required();
draftSchema.required('name', 'email');
```

无参 partial() 若 schema 里有人挂了 transform，类型或运行可能卡住——改用具名 partial('name', 'bio')。

### 列表示例：分页 query

```typescript
// src/schemas/list-query.schema.ts
export const listQuerySchema = schema({ // [!code highlight]
  page: rule.int().min(1).default(1),
  pageSize: rule.int().min(1).max(100).default(20),
  q: rule.string().trim().optional(),
});
```

page / pageSize 有默认：客户端可省略；日志里「未传」会显示成默认值。

Web 路由里能挂 body / query 就别手写 validate 再自己抛 400——类型和错误信封更统一。

报错文案语言跟应用 language 走，见 [Web](/zh/web/#language) · [Console](/zh/console/#language)。

## 下一步

- [手动校验](./validate)（脚本、单测里跑同一套 schema）
- [object](./rules/object) / [array](./rules/array) / [oneOf](./rules/one-of)
- [请求实体](/zh/web/body) / [查询参数](/zh/web/query)