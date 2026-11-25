---
outline: deep
---

# Prisma

在 HTTP 边界拦住「乱写进库」的数据，又不想手写和表结构两份 schema。`@aomex/prisma` 会在 prisma generate 时产出校验用的 generated，业务里用 definePrismaSchema 做覆盖（藏密码、收紧 Json 等）。**不要**直接把生成文件当路由 body() 用——统一从 definePrismaSchema 解包后的 prismaInput / prismaOutput 引用。跳过 definePrismaSchema 直接用 generated 时，生成物面向「表结构」，不是面向「接口契约」。

表里的 Json 字段，生成物默认很宽松；若要 Client 类型和请求校验一致，走下面 **Json 对齐全流程**。

```bash
pnpm add @aomex/prisma
# Json 进 Prisma Client 具名类型时（开发依赖）：
pnpm add -D prisma-json-types-generator
```

1. 在 schema.prisma 挂 generator aomex（和可选的 generator json）  
2. 跑 prisma generate  
3. 写 definePrismaSchema + PrismaJson 声明  
4. 路由上 body(prismaInput.user)、response({ content: prismaOutput.user })

## Json 对齐全链路

**1. schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

generator aomex {
  provider = "aomex-prisma"
  // 脚手架常见：output = "../src/generated/aomex/prisma"
}

generator json {
  provider  = "prisma-json-types-generator"
  namespace = "PrismaJson"
}

model user {
  id         Int      @id @default(autoincrement())
  name       String
  /// [UserProfile] // [!code highlight]
  profile    Json?
  created_at DateTime @default(now())
  updated_at DateTime @default(now()) @updatedAt
}
```

`/// [UserProfile]` 给 json 生成器看：Client 里 profile 会对应你下面声明的 `PrismaJson.UserProfile`。

**2. 生成**

```bash
npx prisma generate
```

勿手改 `src/generated/aomex/prisma*`。

**3. `src/schemas/prisma.schema.ts`**

```typescript
import { rule, type Validator } from '@aomex/common';
import { definePrismaSchema } from '@aomex/prisma';
import { generated } from '@/generated/aomex/prisma';

const userProfile = rule.object({
  theme: rule.enum(['dark', 'light']).optional(),
  bio: rule.string().optional(),
});

declare global {
  namespace PrismaJson {
    type UserProfile = Validator.Infer<typeof userProfile>; // [!code highlight]
  }
}

export const { prismaInput, prismaOutput, prismaEnum } = definePrismaSchema(
  generated,
  {
    user: {
      input: (s) => {
        return s.extend({
          profile: userProfile.optional().nullable(),
        });
      },
      output: (s) => {
        return s.extend({
          profile: userProfile.nullable(),
        });
      },
    },
  },
);
```

**4. 路由**

```typescript
import { body, response, Router } from '@aomex/web';
import { prismaInput, prismaOutput } from '@/schemas/prisma.schema';

export const router = new Router({ prefix: '/users' });

router.post('/', {
  mount: [
    body(prismaInput.user), // [!code highlight]
    response({
      statusCode: 201,
      content: prismaOutput.user,
    }),
  ],
  action: async (ctx) => {
    const user = await createUser(ctx.body);
    ctx.send(201, user);
  },
});
```

无 Json、无敏感字段时，第二参传 {} 也能用生成默认。

## 路由类型与 omit / extend

- ctx.body 挂上 body(prismaInput.user) 后，profile 应是 { theme?, bio? } | null | undefined 这一档，而不是裸 JsonValue。
- PrismaJson.UserProfile 与 userProfile 规则应来自**同一份** rule.object——用 `Validator.Infer<typeof userProfile>` 声明，避免手写两份 interface 漂移。Json 不 extend 对齐时，HTTP 几乎什么都能 POST，Client 却是具名类型，类型和运行时会裂开。
- prismaInput.user.pick('name', 'profile')、partial() 等链式方法在类型上会收窄子集字段，适合 PATCH、部分更新。

创建用户时藏字段、校验密码长度，仍在 definePrismaSchema 里 omit / extend：

```typescript
user: {
  input: (s) => { // [!code highlight]
    return s
      .omit('id', 'created_at', 'updated_at')
      .extend({
        password: rule.string().length({ min: 8 }),
        profile: userProfile.optional().nullable(),
      });
  },
  output: (s) => {
    return s.omit('password').extend({
      profile: userProfile.nullable(),
    });
  },
},
```

## 改表后的步骤与导出

| 步骤 | 常见做法是什么时候动它 |
| --- | --- |
| `generator aomex` output | 生成路径跟脚手架不一致时 |
| `/// [TypeName]` | 新增 Json 字段且要上 Client 具名类型 |
| `userProfile` + `PrismaJson` | 每增加一种 Json 形状各一对 |
| `definePrismaSchema` `extend` | 生成默认太宽 / 要藏 `password` |
| `prisma generate` | 每次改 `schema.prisma` 后 |

| 导出 | 路由里常见用法 |
| --- | --- |
| `prismaInput` | `body()`、部分 `pick` / `partial` |
| `prismaOutput` | `response({ content })` |
| `prismaEnum` | 和表枚举对齐的 `rule.enum` |

路由引用的 prisma schema 会进 [OpenAPI](/zh/openapi/)；改表或 Json 后：prisma generate → 检查覆盖 → [生成OpenAPI](/zh/openapi/)。改表忘了 generate 时，类型仍是旧的，覆盖项可能对不上新字段。

本包**不是** HTTP 中间件，无需挂 `WebApp.mount`。

## 相关

- [验证器总览](/zh/validators/)
- [生成OpenAPI](/zh/openapi/)
- [生成OpenAPI](/zh/openapi/)