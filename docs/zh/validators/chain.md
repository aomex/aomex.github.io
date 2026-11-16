---
outline: deep
---

# 通用链式

在任意 rule.xxx() 上挂**通用链**：管「传没传、能不能 null、要不要默认值、严不严、转不转形、文档怎么写」。和 trim、min 这类**专属**方法正交；专属见 [验证器列表](./builtins) 各专页。

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  page: rule.int().min(1).default(1),
  q: rule.string().trim().optional(),
});

// GET ?page=2&q=ada  → { page: 2, q: 'Ada' }（若你还链了 transform）
// GET 省略 page     → { page: 1, q: undefined }
```

分页默认值 + 可选搜索词，是你在项目里最常搭的第一种组合。

- optional() 之后，字段推断里常见 T | undefined；default(...) 之后多半是「必有值」，客户端没传也会落到默认。
- nullable() 会单独允许 null；和「没传」不是一回事，PATCH 清空字段时类型上是 null，不是 undefined。
- strict() 开着时，字符串 '18' 往往过不了 `rule.int()`；query 里几乎总是字符串进来，通常**不对 query 开 strict**。
- transform(fn) 的返回类型会替换字段类型——`rule.string().transform(...)` 之后推断的是 transform 的返回值，不是 string。
- docs(...) **不改运行时类型**，只影响 OpenAPI 元数据。

个别组合类或 file 可能缺 default / strict，以专页为准。

下面每个方法都带「什么时候用」和可复制 demo；链的顺序可以先类型约束，再 default / optional，最后 transform 和 docs。

### optional()

字段可以不传。undefined 和默认的空串 '' 往往会当成「空」——开了 optional 就通过，值是 undefined。

**什么时候用：** 列表筛选、PATCH 局部更新、Console 可选 flag。

```typescript
import { rule } from '@aomex/common';

// GET /users?q=ada —— q 可以完全不出现
rule.string().trim().optional();
```

已 [default(...)](#default值-值) 时一般不必再写 optional()——有 default 通常就够。字符串若要「空串也算有值」，用 [allowEmptyString()](./rules/string)。

### required()

optional() 的反向：再变回必填。

**什么时候用：** 草稿 schema partial() 之后，正式提交再收紧。

```typescript
import { rule } from '@aomex/common';

const title = rule.string().optional();
title.required();
```

若已有 default(...)，调 required() **通常不会**去掉默认——缺省仍走默认值。

### nullable()

允许 JSON 里的 null，和「没传」分开。

**什么时候用：** PATCH 里「传 null 清空，不传表示不改」。

```typescript
import { rule } from '@aomex/common';

rule.string().nullable().optional();
// null → 清空；没传 → undefined，业务里跳过该字段

rule.int().nullable();
```

未开 nullable 时，null 有时会被当成「空」处理，具体以类型提示为准。

PATCH 要清空字段用 nullable() 传 null；要表示「不改」靠没传 → undefined——别只用 optional() 却分不清两者。

### default(值 | () => 值)

没传或值为空时直接用默认，字段变为非必填；默认值本身**一般不再走一遍类型校验**。

**什么时候用：** 分页、排序、新建资源的初始状态。

```typescript
import { rule } from '@aomex/common';

rule.int().min(1).default(1); // [!code highlight]
rule.enum(['asc', 'desc']).default('desc');
rule.date().default(() => {
  return new Date();
});
```

默认可以是函数，校验时再调用——适合「当前时间」、读配置。日志里「客户端没传」会显示成默认值，排障时要记得。

### strict(is?: boolean)

更硬的类型契约：常见效果是少做宽松转换（比如字符串悄悄变数字）。

**什么时候用：** JSON body 契约很硬；**query / 表单**几乎全是字符串，常见做法是不开。

```typescript
import { rule } from '@aomex/common';

rule.int().strict();
// '18' → 失败

rule.object({ id: rule.int() }).strict();
```

传 strict(false) 可关掉；不是每个工厂都有这条链（例如很多 boolean 场景不靠 strict）。

::: warning
query / 表单几乎全是字符串，在 query 上链 strict() 常见后果是整页 400。
:::

### transform(fn)

校验（含默认）成功后，再把值变成你要的形状；**推断类型跟着返回值走**。

**什么时候用：** query 收 CSV、大小写归一化、入口处转成业务枚举。

```typescript
import { rule } from '@aomex/common';

rule.string().transform((s) => {
  return s.split(',').map((x) => {
    return x.trim();
  });
}); // [!code highlight]

rule.string().optional().transform((s) => {
  return s ?? '';
});
```

可以返回 Promise。别在 transform 里做权限、配额等业务判断——失败路径不清晰，留在 action / 服务层。带 transform 的 schema 做无参 [partial()](./schema#partial) 时可能被限制，可只 partial 指定字段名。

### docs(schema, mode?)

写入 OpenAPI 的 description / example 等，**不影响运行时**。

**什么时候用：** 对接前端、生成文档时要可读字段说明。

```typescript
import { rule } from '@aomex/common';

rule.string().docs({ description: '用户昵称', example: 'Ada' });
rule.string().docs({ title: 'Name' }, 'replace');
```

docs() 只影响 OpenAPI 元数据，**不会改变**运行时校验行为。

| 参数 | 什么时候用 |
| --- | --- |
| `mode: 'merge'`（默认） | 在已有 docs 上追加 |
| `mode: 'replace'` | 整份覆盖 |

### Validator.has(source, Type)

静态方法：探测验证器或字段表里是否**嵌套包含**某验证器类。

**什么时候用：** 写插件、代码生成时偶尔用；业务 action 里几乎不需要。

```typescript
import { Validator, rule, StringValidator } from '@aomex/common';

Validator.has(rule.string(), StringValidator);
Validator.has({ nest: { name: rule.string() } }, StringValidator);
```

## 下一步

- [schema](./schema)（partial / pick / extend）
- [验证器列表](./builtins)（按任务找 rule.xxx()）
- [查询参数](/zh/web/query) / [请求实体](/zh/web/body)（链式规则挂到路由上）