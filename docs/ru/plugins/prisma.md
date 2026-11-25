---
outline: deep
---

# Prisma

На границе HTTP не пускать «мусор» в БД и не вести вторую ручную schema под таблицы. `@aomex/prisma` при `prisma generate` выдаёт generated для валидации; в коде — definePrismaSchema с переопределениями (скрыть password, ужать Json). **Не** подставляйте generated напрямую в body() роута — только prismaInput / prismaOutput после definePrismaSchema. Прямой generated — про схему таблицы, не про контракт API.

Поля Json в таблице по умолчанию в generated очень широкие; чтобы тип Client и проверка запроса совпали — **полная цепочка Json** ниже.

```bash
pnpm add @aomex/prisma
# Именованный тип Json в Prisma Client (dev-зависимость):
pnpm add -D prisma-json-types-generator
```

1. В schema.prisma — generator aomex (и опционально generator json)  
2. prisma generate  
3. definePrismaSchema + объявления PrismaJson  
4. На роуте body(prismaInput.user), response({ content: prismaOutput.user })

## Полная цепочка Json

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

`/// [UserProfile]` для json-генератора: в Client поле profile соответствует `PrismaJson.UserProfile` ниже.

**2. Генерация**

```bash
npx prisma generate
```

Не правьте `src/generated/aomex/prisma*` вручную.

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

**4. Роут**

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

Без Json и чувствительных полей второй аргумент `{}` — дефолты generated.

## Типы роута и omit / extend

- После body(prismaInput.user) у ctx.body profile — уровень { theme?, bio? } | null | undefined, не голый JsonValue.
- PrismaJson.UserProfile и rule userProfile — **один** rule.object; объявляйте через `Validator.Infer<typeof userProfile>`, не два interface. Без extend Json в HTTP пустит что угодно, Client — именованный тип: расхождение типов и рантайма.
- pick / partial на prismaInput.user сужают тип — PATCH, частичные обновления.

Создание пользователя: скрыть поля, длина password — omit / extend в definePrismaSchema:

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

## После смены схемы и экспорты

| Шаг | Когда |
| --- | --- |
| output `generator aomex` | Путь генерации ≠ scaffold |
| `/// [TypeName]` | Новое Json и именованный тип в Client |
| `userProfile` + `PrismaJson` | Пара на каждую форму Json |
| `extend` в definePrismaSchema | generated слишком широкий / скрыть `password` |
| `prisma generate` | После каждого изменения schema.prisma |

| Экспорт | На роуте |
| --- | --- |
| `prismaInput` | `body()`, pick / partial |
| `prismaOutput` | `response({ content })` |
| `prismaEnum` | `rule.enum` как в таблице |

Prisma schema на роутах попадает в [OpenAPI](/ru/openapi/). После таблицы/Json: prisma generate → проверить overrides → [генерация OpenAPI](/ru/openapi/). Забыли generate — типы старые, overrides не бьются с новыми полями.

Пакет **не** HTTP middleware, `WebApp.mount` не нужен.

## См. также

- [валидаторы](/ru/validators/)
- [генерация OpenAPI](/ru/openapi/)
- [генерация OpenAPI](/ru/openapi/)