---
outline: deep
---

# Mongoose

MongoDB 專案裡常見痛點是：**HTTP 入參一套校驗、Mongoose Schema 再手寫一套**，欄位一改兩處飄。defineMongooseModel 用與路由相同的 rule 生成 Mongoose Schema，並擴充套件 ObjectId / Decimal128 校驗——本頁把模型定義、HTTP 銜接和型別預期串起來。

複雜索引、Mongoose 中介軟體、僅 DB 存在的欄位仍要在模型或路由 response 裡自己補；橋接包蓋不住的全部塞回 Mongoose。

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

Mongo 專用規則要先載入包註冊（路徑按你專案入口調整）：

```typescript
import { rule } from '@aomex/common';
import '@aomex/mongoose';

rule.mongoObjectId();
rule.mongoDecimal128();
```

典型分層（本包**不是**中介軟體）：

1. models/user.ts — defineMongooseModel
2. schemas/user.schema.ts — 共享入參 / 出參 schema
3. routers/user.ts — body / response 引用 schema 或欄位表
4. web.ts — 正常 WebApp + routers

```typescript
import { body, response } from '@aomex/web';
import { userBodySchema } from '../schemas/user.schema.js';

router.post('/users', {
  mount: [body(userBodySchema)], // [!code highlight]
  response: { content: { /* 对外 DTO，别默认泄露仅 DB 字段 */ } },
  action: async (ctx) => {
    await User.create(ctx.body);
    ctx.send({ ok: true });
  },
});
```

defineMongooseModel 返回標準 Mongoose Model，並帶上**輸入/輸出**相關推斷——建立、查詢時懸停文件欄位，往往能和 rule 鏈對齊。schemas 裡巢狀裸物件會自動收成物件校驗，寫法與路由 body({ ... }) 同款。rule.mongoObjectId() 等要在 **import '@aomex/mongoose' 之後** 才出現在 rule 上；否則型別和執行時都對不上（忘記 side-effect import 時註冊不到）。另有 formatMongoResult：查詢結果整理成更 JSON 友好的形態（如 _id、Decimal），按包匯出與型別提示使用。

## 模型欄位與對外 DTO

| 欄位 / 選項 | 什麼時候用 |
| --- | --- |
| `schemas` | 欄位 → Validator，或巢狀物件 |
| `indexes` | `{ fields, ...IndexOptions }[]` |
| `timestamps` / `versionKey` | 與 Mongoose SchemaOptions 一致 |
| 其它 SchemaOptions | 透傳給 Mongoose |
| 路由 `response({ content })` | 對外 DTO；僅 DB 欄位不要預設進 API |

和 [Prisma](/zh-TW/plugins/prisma) 場景不同：這裡是 Mongoose + Mongo，不是 definePrismaSchema。

只定義模型、路由仍手寫另一套 shape 時，改欄位仍要改兩處，違背「共用 rule」的初衷。別把 Mongoose 文件原樣 ctx.send——敏感或僅 DB 欄位會洩露；用 response 或顯式 pick。校驗器蓋不住唯一複合索引、pre hook 等，仍在模型層配置。

## 相關

- 自定義 Mongo 規則實現思路：[自定義驗證器](/zh-TW/advanced/validator)（mongoObjectId 同源套路）
- HTTP 入參：[請求實體](/zh-TW/web/body)
- 驗證器列表：[builtins](/zh-TW/validators/builtins)