---
outline: deep
---

# Prisma

HTTP 경계에서 나쁜 데이터를 막되 손으로 쓴 schema 복제본을 유지하지 않습니다. `definePrismaSchema` + 생성된 `rule`로 라우트 `body`/`response`와 DB 모델을 맞춥니다.

Json 필드는 `/// [Name]` + `PrismaJson` + `Validator.Infer` 체인—스캐폴드와 같게.

```bash
pnpm add @aomex/prisma
# Json 进 Prisma Client 具名类型时（开发依赖）：
pnpm add -D prisma-json-types-generator
```

1. `schema.prisma`에 `generator aomex`(선택 `generator json`)
2. `prisma generate` 실행
3. `definePrismaSchema` + `src/schemas/prisma.schema.ts` 작성
4. 라우트에 mount

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

`/// [UserProfile]`은 json generator 힌트—Client `profile`이 아래 `PrismaJson.UserProfile`에 매핑.

**2. 생성**

```bash
npx prisma generate
```

`src/generated/aomex/prisma*`는 손으로 편집하지 마세요.

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

**4. 라우트**

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

Json·민감 필드 없으면 두 번째 인자 `{}`도 생성 기본과 동작.

## 라우트 타입, omit, extend

- `definePrismaSchema` 반환 schema로 `body()` / `response()`
- `omit` / `pick` / `extend`는 생성 타입과 맞추기

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

## schema 변경 후

| 단계 | 때 |
| --- | --- |
| `generator aomex` 출력 | 스캐폴드 경로와 다를 때 |
| `/// [Type]` 주석 | Json 필드마다 |
| `prisma generate` + 라우트 재검토 | 마이그레이션·필드 추가 후 |

마이그레이션 없이 DB만 바꾸면 런타임과 문서가 어긋납니다.

## 관련

- [Mongoose](/ko/plugins/mongoose) (Mongo 경로)
- 검증: [스키마](/ko/validators/schema)