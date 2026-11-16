---
outline: deep
---

# Prisma

Отсекайте плохие данные на границе HTTP без второй схемы руками. `@aomex/prisma` генерирует артефакты валидации на `prisma generate`; `definePrismaSchema` — override (скрыть пароль, ужесточить Json). **Не** используйте сгенерированные файлы напрямую в `body()` — только `prismaInput` / `prismaOutput` из `definePrismaSchema`. Без `definePrismaSchema` останутся табличные формы, не API-контракты.

Json-колонки в генерации по умолчанию «свободные»; для Client и валидации запроса — **цепочка выравнивания Json** ниже.

```bash
pnpm add @aomex/prisma
# Json 进 Prisma Client 具名类型时（开发依赖）：
pnpm add -D prisma-json-types-generator
```

1. `generator aomex` (и опционально `generator json`) в `schema.prisma`  
2. `prisma generate`  
3. `definePrismaSchema` + объявления `PrismaJson`  
4. Маршруты: `body(prismaInput.user)`, `response({ content: prismaOutput.user })`

## Выравнивание Json end-to-end

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

`/// [UserProfile]` говорит json-генератору — в Client `profile` → `PrismaJson.UserProfile` ниже.

**2. Генерация**

```bash
npx prisma generate
```

Не правьте вручную `src/generated/aomex/prisma*`.

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

**4. Маршруты**

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

Без Json и чувствительных полей второй аргумент `{}` всё ещё работает с дефолтами генерации.

## Типы маршрутов, omit, extend

- С `body(prismaInput.user)` у `profile` должно быть `{ theme?, bio? } | null | undefined`, не сырой `JsonValue`.
- `PrismaJson.UserProfile` и правила `userProfile` — **один** `rule.object`; объявляйте `Validator.Infer<typeof userProfile>`, не дублируйте интерфейсы.
- `prismaInput.user.pick('name', 'profile')`, `partial()` и т.д. сужают PATCH.

Скрытие полей и длина пароля внутри `definePrismaSchema`:

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

## После изменения schema

| Шаг | Когда |
| --- | --- |
| Вывод `generator aomex` | Путь ≠ scaffold |
| `/// [TypeName]` | Новое Json-поле — именованный тип в Client |
| `userProfile` + `PrismaJson` | Одна пара на форму Json |
| `extend` в `definePrismaSchema` | Генерация слишком широкая / скрыть `password` |
| `prisma generate` | После каждого изменения `schema.prisma` |

| Экспорт | На маршруте |
| --- | --- |
| `prismaInput` | `body()`, `pick` / `partial` |
| `prismaOutput` | `response({ content })` |
| `prismaEnum` | `rule.enum` по таблице |

Связанные prisma-schema идут в [OpenAPI](/ru/plugins/openapi); после таблиц/Json: `prisma generate` → overrides → [экспорт контракта](/ru/console/openapi). Забыли generate — устаревшие типы.

Не HTTP-middleware — нет `WebApp.mount`.

## Связанное

- [Обзор валидаторов](/ru/validators/)
- [Генерация OpenAPI](/ru/plugins/openapi)
- [Экспорт OpenAPI](/ru/console/openapi)
