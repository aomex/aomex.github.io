---
outline: deep
---

# Prisma

Block bad data at the HTTP boundary without maintaining a hand-written schema duplicate of the DB. `@aomex/prisma` generates validation artifacts on `prisma generate`; use `definePrismaSchema` for overrides (hide passwords, tighten Json, etc.). **Do not** use generated files directly as route `body()`—always use `prismaInput` / `prismaOutput` from `definePrismaSchema`. Skipping `definePrismaSchema` leaves table-oriented shapes, not API contracts.

Json columns default loose in generated validators; for aligned Client types and request validation, follow the **Json alignment flow** below.

```bash
pnpm add @aomex/prisma
# Named Json types in Prisma Client (dev dependency):
pnpm add -D prisma-json-types-generator
```

1. Add `generator aomex` (and optional `generator json`) in `schema.prisma`  
2. Run `prisma generate`  
3. Write `definePrismaSchema` + `PrismaJson` declarations  
4. Routes: `body(prismaInput.user)`, `response({ content: prismaOutput.user })`

## Json alignment end to end

**1. schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

generator aomex {
  provider = "aomex-prisma"
  // scaffold often: output = "../src/generated/aomex/prisma"
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

`/// [UserProfile]` tells the json generator—Client `profile` maps to `PrismaJson.UserProfile` below.

**2. Generate**

```bash
npx prisma generate
```

Do not hand-edit `src/generated/aomex/prisma*`.

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

**4. Routes**

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

No Json or sensitive fields: second arg `{}` still works with generated defaults.

## Route types, omit, extend

- With `body(prismaInput.user)`, `profile` should be `{ theme?, bio? } | null | undefined`, not raw `JsonValue`.
- `PrismaJson.UserProfile` and `userProfile` rules must be the **same** `rule.object`—declare with `Validator.Infer<typeof userProfile>`, not duplicate interfaces.
- `prismaInput.user.pick('name', 'profile')`, `partial()`, etc. narrow for PATCH.

Hide fields and validate password length inside `definePrismaSchema`:

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

## After schema changes

| Step | When |
| --- | --- |
| `generator aomex` output | Path differs from scaffold |
| `/// [TypeName]` | New Json field needs Client named type |
| `userProfile` + `PrismaJson` | One pair per Json shape |
| `definePrismaSchema` `extend` | Generated too wide / hide `password` |
| `prisma generate` | After every `schema.prisma` change |

| Export | Route usage |
| --- | --- |
| `prismaInput` | `body()`, `pick` / `partial` |
| `prismaOutput` | `response({ content })` |
| `prismaEnum` | Table-aligned `rule.enum` |

Referenced prisma schemas feed [OpenAPI](/en/openapi/); after table/Json changes: `prisma generate` → check overrides → [Generate OpenAPI](/en/openapi/). Forgot generate → stale types.

Not HTTP middleware—no `WebApp.mount`.

## Related

- [Validators overview](/en/validators/)
- [Generate OpenAPI](/en/openapi/)
- [Generate OpenAPI](/en/openapi/)