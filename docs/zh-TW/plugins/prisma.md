---
outline: deep
---

# Prisma

在 HTTP 邊界攔住「亂寫進庫」的資料，又不想手寫和表結構兩份 schema。`@aomex/prisma` 會在 prisma generate 時產出校驗用的 generated，業務裡用 definePrismaSchema 做覆蓋（藏密碼、收緊 Json 等）。**不要**直接把生成檔案當路由 body() 用——統一從 definePrismaSchema 解包後的 prismaInput / prismaOutput 引用。跳過 definePrismaSchema 直接用 generated 時，生成物面向「表結構」，不是面向「介面契約」。

表裡的 Json 欄位，生成物預設很寬鬆；若要 Client 型別和請求校驗一致，走下面 **Json 對齊全流程**。

```bash
pnpm add @aomex/prisma
# Json 进 Prisma Client 具名类型时（开发依赖）：
pnpm add -D prisma-json-types-generator
```

1. 在 schema.prisma 掛 generator aomex（和可選的 generator json）  
2. 跑 prisma generate  
3. 寫 definePrismaSchema + PrismaJson 宣告  
4. 路由上 body(prismaInput.user)、response({ content: prismaOutput.user })

## Json 對齊全鏈路

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

`/// [UserProfile]` 給 json 生成器看：Client 裡 profile 會對應你下面宣告的 `PrismaJson.UserProfile`。

**2. 生成**

```bash
npx prisma generate
```

勿手改 `src/generated/aomex/prisma*`。

**3. `src/schemas/prisma.schema.ts`**

```typescript
import { rule, type Validator } from '@aomex/common';
import { definePrismaSchema } from '@aomex/prisma';
import { generated } from '../generated/aomex/prisma.js';

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
import { prismaInput, prismaOutput } from '../schemas/prisma.schema.js';

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

無 Json、無敏感欄位時，第二參傳 {} 也能用生成預設。

## 路由型別與 omit / extend

- ctx.body 掛上 body(prismaInput.user) 後，profile 應是 { theme?, bio? } | null | undefined 這一檔，而不是裸 JsonValue。
- PrismaJson.UserProfile 與 userProfile 規則應來自**同一份** rule.object——用 `Validator.Infer<typeof userProfile>` 宣告，避免手寫兩份 interface 漂移。Json 不 extend 對齊時，HTTP 幾乎什麼都能 POST，Client 卻是具名型別，型別和執行時會裂開。
- prismaInput.user.pick('name', 'profile')、partial() 等鏈式方法在型別上會收窄子集欄位，適合 PATCH、部分更新。

建立使用者時藏欄位、校驗密碼長度，仍在 definePrismaSchema 裡 omit / extend：

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

## 改表後的步驟與匯出

| 步驟 | 常見做法是什麼時候動它 |
| --- | --- |
| `generator aomex` output | 生成路徑跟腳手架不一致時 |
| `/// [TypeName]` | 新增 Json 欄位且要上 Client 具名型別 |
| `userProfile` + `PrismaJson` | 每增加一種 Json 形狀各一對 |
| `definePrismaSchema` `extend` | 生成預設太寬 / 要藏 `password` |
| `prisma generate` | 每次改 `schema.prisma` 後 |

| 匯出 | 路由裡常見用法 |
| --- | --- |
| `prismaInput` | `body()`、部分 `pick` / `partial` |
| `prismaOutput` | `response({ content })` |
| `prismaEnum` | 和表列舉對齊的 `rule.enum` |

路由引用的 prisma schema 會進 [OpenAPI](/zh-TW/plugins/openapi)；改表或 Json 後：prisma generate → 檢查覆蓋 → [落盤契約](/zh-TW/console/openapi)。改表忘了 generate 時，型別仍是舊的，覆蓋項可能對不上新欄位。

本包**不是** HTTP 中介軟體，無需掛 `WebApp.mount`。

## 相關

- [驗證器總覽](/zh-TW/validators/)
- [OpenAPI 生成](/zh-TW/plugins/openapi)
- [OpenAPI 落盤](/zh-TW/console/openapi)