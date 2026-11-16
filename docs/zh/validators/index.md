---
outline: deep
---

# 验证器

把一坨「外面随便丢进来的数据」收成你敢用的对象：运行时拦住脏数据，TypeScript 里类型跟着变窄。Web 的 body() / query()、Console 的 options()、OpenAPI，通常**共用同一套 rule**，少抄一份 interface。

```typescript
import { rule, validate, schema, type Validator } from '@aomex/common';
```

```typescript
import { rule, validate } from '@aomex/common';

const input = { name: '  Ada  ', age: '18', hack: true };

const user = await validate(input, { // [!code highlight]
  name: rule.string().trim().length({ min: 1, max: 32 }),
  age: rule.int().min(0).optional(),
});

await doSomething(user);
```

悬停 user：

- name → string（已 trim）
- age → number | undefined（'18' 一般会收成数字；可选）
- 没有 hack——没声明的键，默认丢掉

在路由里更常见：挂 `body({ ... })` 之后，ctx.body 直接是收窄后的类型，不必再手写 validate。

::: tip
别维护 Zod 一套再加手写 interface——改字段时最容易漂；这里一份 rule 扛运行时和类型两边。
:::

## 项目里怎么选工具

| 你想做的事 | 用什么 |
| --- | --- |
| 单个字段 | `rule.string()` / `rule.int()` … → [验证器列表](./builtins) |
| 一堆字段要复用 / PATCH 派生 | [`schema`](./schema)，放 `src/schemas/xxx.schema.ts` |
| 脚本 / 测试里验一把 | [手动校验](./validate) |
| 嵌套、数组、二选一 | [object](./rules/object) / [array](./rules/array) / [oneOf](./rules/one-of) |
| 「传没传 / 默认值 / 文档备注」 | [通用链式](./chain) |

真要透传任意键，用 [rule.record()](./rules/record) 说清楚，别指望未声明字段会自动保留。

::: warning
rule.any() 能跑，但类型和 OpenAPI 都会糊；过渡用可以，尽量少留在对外 API。
:::

## 本栏目

| 篇目 | 什么时候点开 |
| --- | --- |
| [验证器列表](./builtins) | 找具体 `rule.xxx` |
| [通用链式](./chain) | `optional` / `default` / `transform`… |
| [schema](./schema) | pick / omit / partial |
| [Prisma](/zh/plugins/prisma) | 从表结构生成校验 |
| [手动校验](./validate) | 脚本 / 单测里直接调 `validate` |
| [自定义验证器](/zh/advanced/validator) | 内置不够时再来（高级） |
