---
outline: deep
---

# Prisma

HTTP 境界で「DB に不正データを書かない」ようにしつつ、テーブル構造の二重 schema 手書きを避ける。`@aomex/prisma` は `prisma generate` 時に検証用 generated を出し、業務では definePrismaSchema で上書き（パスワード隠蔽、Json 締め等）。**生成ファイルをそのままルート body() に使わない**——definePrismaSchema 解包後の prismaInput / prismaOutput を統一参照。generated 直利用は「テーブル向け」で「API 契約向け」ではない。

テーブルの Json フィールドは generated デフォルトが緩い。Client 型とリクエスト検証を揃えるなら下記 **Json 全链路**。

```bash
pnpm add @aomex/prisma
# Json を Prisma Client の名前付き型にする場合（dev 依存）：
pnpm add -D prisma-json-types-generator
```

1. schema.prisma に generator aomex（任意で generator json）  
2. prisma generate  
3. definePrismaSchema + PrismaJson 宣言  
4. ルートで body(prismaInput.user)、response({ content: prismaOutput.user })

## Json 全链路

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

`/// [UserProfile]` は json ジェネレーター向け：Client で profile は下で宣言する `PrismaJson.UserProfile` に対応。

**2. 生成**

```bash
npx prisma generate
```

`src/generated/aomex/prisma*` は手編集しない。

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

**4. ルート**

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

Json も機密もなければ第二引数 `{}` で generated デフォルトでも可。

## ルート型と omit / extend

- body(prismaInput.user) 後、ctx.body の profile は { theme?, bio? } | null | undefined 相当で、裸 JsonValue ではない。
- PrismaJson.UserProfile と userProfile rule は**同一** rule.object から——`Validator.Infer<typeof userProfile>` で宣言し、interface 二重管理でずれない。Json を extend しないと HTTP は何でも POST でき Client は名前型——型と実行が裂ける。
- prismaInput.user.pick('name', 'profile')、partial() 等は型で部分集合に。PATCH 向き。

ユーザー作成でフィールド隠し・パスワード長は definePrismaSchema 内 omit / extend：

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

## スキーマ変更後と export

| ステップ | いつ触るか |
| --- | --- |
| `generator aomex` output | 生成パスが脚手架と違うとき |
| `/// [TypeName]` | Json 追加で Client 名前型が要るとき |
| `userProfile` + `PrismaJson` | Json 形状ごとに一対 |
| `definePrismaSchema` `extend` | generated デフォルトが広い / `password` 隠す |
| `prisma generate` | schema.prisma 変更のたび |

| export | ルートでの典型 |
| --- | --- |
| `prismaInput` | `body()`、一部 `pick` / `partial` |
| `prismaOutput` | `response({ content })` |
| `prismaEnum` | テーブル enum に揃えた `rule.enum` |

ルート参照の prisma schema は [OpenAPI](/ja/openapi/) に入る。表/Json 変更後：prisma generate → 上書き確認 → [OpenAPI 生成](/ja/openapi/)。generate 忘れだと型は古いまま、上書きが新フィールドとずれる。

本パッケージ**は** HTTP ミドルウェアではない。`WebApp.mount` 不要。

## 関連

- [バリデータ概要](/ja/validators/)
- [OpenAPI 生成](/ja/openapi/)
- [OpenAPI 生成](/ja/openapi/)