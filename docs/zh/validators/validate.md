---
outline: deep
---

# 手动校验

在**非 Web 路由**场景里，拿任意数据对照规则过一遍：单测、脚本、自己写的中间件。Web 上挂 body() / query() 时，底层也是同一套；这里是你亲手调 `validate` 的入口。

```typescript
import { validate } from '@aomex/common';
import { createUserSchema } from '../schemas/user.schema.js';

const input = { name: 'Ada', email: 'ada@example.com' };

const user = await validate(input, createUserSchema); // [!code highlight]
// 通过：user 已是 Infer 后的类型
// 失败：抛错（默认行为）
```

路由里 `mount: [body(createUserSchema)]` 等价于这种「不过关就中断」的姿势，只是错误会被收成 HTTP 400。

validate 只管形状；库存、权限、重复注册仍在 service / action。

validate 返回 Promise，漏写 await 会把 Promise 当结果用。

- 第一个参数是宽类型（配置、unknown、测试夹具）；成功后返回值收窄为 `Validator.Infer<typeof schema>`。
- 默认 throwOnError: true：失败时**没有**可用的返回值，直接进 catch 或冒泡。
- `{ throwOnError: false }` 时返回 `{ data, errors }`；**成功看 `errors === null`**，别看 `data === null`——开了 nullable() 时合法值本来就可以是 null。

::: warning
用 `data === null` 判断失败会误判：nullable() 字段通过时 data 可能就是 null。
:::

- 失败且 `throwOnError: false` 时，errors 一般是 `string[]`，适合一次性回给表单多项红字。

| 写法 | 什么时候用 |
| --- | --- |
| `await validate(input, schema)` | 脚本、单测、中间件——失败就停 |
| `validate(input, schema, { throwOnError: false })` | 管理后台表单，要**全部**错误一起展示 |
| 同一份 `schema` + `validate` / `body()` | 规则只维护一处 |

### 不抛错：收集全部错误

```typescript
import { validate } from '@aomex/common';
import { createUserSchema } from '../schemas/user.schema.js';

const input = { name: '', email: 'not-email' };

const result = await validate(input, createUserSchema, { throwOnError: false }); // [!code highlight]

if (result.errors === null) {
  await db.user.create(result.data);
} else {
  return { ok: false, errors: result.errors };
}
```

### 和路由的分工

**HTTP 入口**用 body / query / params；**读配置文件、跑 Cron 前检查、单测造数据**用 validate。规则都活在 `src/schemas/` 里。

Web API 里到处手写 validate 再自己 throw(400) 既重复又让 OpenAPI 不整齐——能挂中间件就挂。

## 下一步

- [schema](./schema)
- [通用链式](./chain)（在字段上收窄形状）
- [错误格式](/zh/web/errors)（Web 里抛错后的 JSON 信封）
