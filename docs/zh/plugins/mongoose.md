---
outline: deep
---

# Mongoose

MongoDB 项目里常见痛点是：**HTTP 入参一套校验、Mongoose Schema 再手写一套**，字段一改两处飘。defineMongooseModel 用与路由相同的 rule 生成 Mongoose Schema，并扩展 ObjectId / Decimal128 校验——本页把模型定义、HTTP 衔接和类型预期串起来。

复杂索引、Mongoose 中间件、仅 DB 存在的字段仍要在模型或路由 response 里自己补；桥接包盖不住的全部塞回 Mongoose。

## defineMongooseModel

```bash
pnpm add @aomex/mongoose mongoose
```

```typescript
import { rule } from '@aomex/common';
import { defineMongooseModel } from '@aomex/mongoose';

export const User = defineMongooseModel('users', { // [!code highlight]
  schemas: {
    name: rule.string(),
    email: rule.email(),
    profile: {
      bio: rule.string().optional(),
    },
  },
  timestamps: true,
  indexes: [{ fields: { email: 1 }, unique: true }],
});
```

Mongo 专用规则要先加载包注册（路径按你项目入口调整）：

```typescript
import { rule } from '@aomex/common';
import '@aomex/mongoose';

rule.mongoObjectId();
rule.mongoDecimal128();
```

典型分层（本包**不是**中间件）：

1. models/user.ts — defineMongooseModel
2. schemas/user.schema.ts — 共享入参 / 出参 schema
3. routers/user.ts — body / response 引用 schema 或字段表
4. web.ts — 正常 WebApp + routers

```typescript
import { body, response } from '@aomex/web';
import { userBodySchema } from '@/schemas/user.schema';

router.post('/users', {
  mount: [body(userBodySchema)], // [!code highlight]
  response: { content: { /* 对外 DTO，别默认泄露仅 DB 字段 */ } },
  action: async (ctx) => {
    await User.create(ctx.body);
    ctx.send({ ok: true });
  },
});
```

defineMongooseModel 返回标准 Mongoose Model，并带上**输入/输出**相关推断——创建、查询时悬停文档字段，往往能和 rule 链对齐。schemas 里嵌套裸对象会自动收成对象校验，写法与路由 body({ ... }) 同款。rule.mongoObjectId() 等要在 **import '@aomex/mongoose' 之后** 才出现在 rule 上；否则类型和运行时都对不上（忘记 side-effect import 时注册不到）。另有 formatMongoResult：查询结果整理成更 JSON 友好的形态（如 _id、Decimal），按包导出与类型提示使用。

## 模型字段与对外 DTO

`schemas` 里写字段 → Validator（嵌套裸对象会自动收成对象校验）。`indexes`、`timestamps`、`versionKey` 以及其它 SchemaOptions 透传给 Mongoose——唯一复合索引、pre hook 等校验器盖不住的，仍在模型层配。

对外别把 Mongoose 文档原样 `ctx.send`：敏感或仅 DB 字段会泄露。路由上用 `response({ content })` 或显式 pick 收成 DTO。

和 [Prisma](/zh/plugins/prisma) 场景不同：这里是 Mongoose + Mongo，不是 definePrismaSchema。只定义模型、路由仍手写另一套 shape 时，改字段仍要改两处，违背「共用 rule」的初衷。

## 相关

- 自定义 Mongo 规则实现思路：[自定义验证器](/zh/advanced/validator)（mongoObjectId 同源套路）
- HTTP 入参：[请求实体](/zh/web/body)
- 验证器列表：[builtins](/zh/validators/builtins)