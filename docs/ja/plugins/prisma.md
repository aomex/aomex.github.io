---
outline: deep
---

# Prisma

HTTP 境界で「DB に変なデータ」を止めつつ、表構造と二重の schema を手書きしたくない。`@aomex/prisma` は prisma generate 時に検証用 generated を出し、業務では definePrismaSchema で上書き（パスワード隠蔽、Json 絞り込み等）。**生成ファイルをそのままルート body() に使わない**——definePrismaSchema 解包後の prismaInput / prismaOutput から参照。definePrismaSchema を飛ばして generated 直使いは「表構造」向けで「API 契約」ではない。

表の Json フィールドは generated が緩いことが多い。Client 型とリクエスト検証を揃えるなら下記 **Json 整合フルフロー**。

```bash
pnpm add @aomex/prisma
# Json 进 Prisma Client 具名类型时（开发依赖）：
pnpm add -D prisma-json-types-generator
```

1. schema.prisma に generator aomex（任意で generator json）  
2. prisma generate 実行  
3. definePrismaSchema + PrismaJson 宣言  
4. ルートで body(prismaInput.user)、response({ content: prismaOutput.user })

## Json 整合の全工程

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

`/// [UserProfile]` は json ジェネレータ向け：Client の profile が下で宣言する `PrismaJson.UserProfile` に対応。

**2. 生成**

```bash
npx prisma generate
```

`src/generated/aomex/prisma*` は手編集しない。

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

**4. ルート**

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

Json なし・機密フィールドなしなら第 2 引数 {} で generated 既定が使える。

## ルート型と omit / extend

- body(prismaInput.user) 後、ctx.body の profile は { theme?, bio? } | null | undefined 程度であり、裸 JsonValue ではない。
- PrismaJson.UserProfile と userProfile ルールは**同じ** rule.object 由来——`Validator.Infer<typeof userProfile>` で宣言し、interface 二重持ちを避ける。Json を extend しないと HTTP は何でも POST でき Client は具名型——型と実行時が割れる。
- prismaInput.user.pick('name', 'profile')、partial() 等は型上サブセットに。PATCH・部分更新向き。

ユーザー作成でフィールド隠蔽・パスワード長は definePrismaSchema の omit / extend：

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

## スキーマ変更後の手順と export

| 手順 | いつ触るか |
| --- | --- |
| `generator aomex` output | 生成パスがスキャフォールドと違うとき |
| `/// [TypeName]` | Json 列追加で Client 具名型が要る |
| `userProfile` + `PrismaJson` | Json 形状ごとに 1 組 |
| `definePrismaSchema` `extend` | generated 既定が広い / `password` を隠す |
| `prisma generate` | `schema.prisma` 変更のたび |

| export | ルートでの典型 |
| --- | --- |
| `prismaInput` | `body()`、`pick` / `partial` |
| `prismaOutput` | `response({ content })` |
| `prismaEnum` | 表 enum に合わせた `rule.enum` |

ルートの prisma schema 参照は [OpenAPI](/ja/openapi/) に入る。表や Json 変更後：prisma generate → 上書き確認 → [OpenAPI を生成](/ja/openapi/)。generate 忘れは型が古いまま、上書きが新フィールドと合わない。

本パッケージは** HTTP ミドルウェアではない**。`WebApp.mount` は不要。

## 関連

- [バリデータ概要](/ja/validators/)
- [生成OpenAPI](/ja/openapi/)
- [OpenAPI を生成](/ja/openapi/)