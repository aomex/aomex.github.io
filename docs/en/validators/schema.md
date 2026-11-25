---
outline: deep
---

# schema

Bundle field tables for users, orders, pagination into reusable units in `src/schemas/xxx.schema.ts`—routes use `body(schema)` / `query(schema)`, tests use `validate(input, schema)`—one rule set, one `Validator.Infer` type, less copy-paste.

```typescript
// src/schemas/user.schema.ts
import { schema, rule, type Validator } from '@aomex/common';

export const userSchema = schema({ // [!code highlight]
  id: rule.int(),
  name: rule.string().trim().length({ min: 1 }),
  email: rule.email(),
  password: rule.string().length({ min: 8 }),
});

export type User = Validator.Infer<typeof userSchema>;
```

```typescript
// src/routers/users.ts
import { body, Router } from '@aomex/web';
import { userSchema } from '@/schemas/user.schema';

export const router = new Router();

router.post('/register', {
  mount: [body(userSchema.omit('id'))], // [!code highlight]
  action: async (ctx) => {
    await register(ctx.body);
    ctx.send(201);
  },
});
```

Per-field `optional` / `default` still live in [Common chains](./chain); below covers **schema-level** methods.

- `Validator.Infer<typeof userSchema>` is the post-validation object type—should match narrowed `ctx.body`.
- `pick` / `omit` / `extend` produce **new** schemas and types; OpenAPI component names do not inherit—call `asName(...)` on each shape you want in the component library.
- `partial()` makes fields optional; bare `partial()` may be blocked at the type level if any field has `transform`—use named `partial('name', 'bio')`.
- `required()` tightens the other way; fields with `default` still get defaults when missing after tighten.

| Method | When to use |
| --- | --- |
| `schema({ ... })` | First bundle into a unit |
| `asName('User')` | `$ref` in OpenAPI `components.schemas` |
| `pick('email', 'password')` | Login needs two fields only |
| `omit('password')` | Public DTOs, registration must not send `id` |
| `extend({ nickname: rule.string() })` | Registration adds fields on account base |
| `partial()` / `partial('name')` | PATCH, draft updates |
| `required()` / `required('name')` | Draft becomes formal submit |

### asName(name)

The name does **not** flow to later `pick` / `omit` / `extend` / `partial` / `required` results—call `asName` again on each shape entering the component library.

```typescript
export const userSchema = schema({
  id: rule.int(),
  name: rule.string(),
  password: rule.string(),
}).asName('User'); // [!code highlight]

export const publicUserSchema = userSchema.omit('password').asName('PublicUser');
```

### pick / omit

```typescript
import { userSchema } from '@/schemas/user.schema';

userSchema.pick('email', 'password');
userSchema.omit('password');
```

Register with `body(userSchema)` but forgot `omit('id')`—clients should not set primary keys; derive a create-specific schema.

### extend

Same key in the argument wins; pass a field table or another schema.

```typescript
export const accountSchema = schema({
  email: rule.email(),
  password: rule.string().length({ min: 8, max: 128 }),
}).asName('Account');

export const registerSchema = accountSchema.extend({ // [!code highlight]
  nickname: rule.string().trim().length({ min: 1, max: 32 }),
});
```

New shape after `extend` without `asName` stays inline in OpenAPI—bad for `$ref`.

### partial / required

```typescript
import { userSchema } from '@/schemas/user.schema';

userSchema.pick('name', 'email', 'bio').partial(); // [!code highlight]

const draftSchema = userSchema.partial();
draftSchema.required();
draftSchema.required('name', 'email');
```

Bare `partial()` with `transform` on a field may stall types or runtime—use named `partial('name', 'bio')`.

### Example: list query

```typescript
// src/schemas/list-query.schema.ts
export const listQuerySchema = schema({ // [!code highlight]
  page: rule.int().min(1).default(1),
  pageSize: rule.int().min(1).max(100).default(20),
  q: rule.string().trim().optional(),
});
```

`page` / `pageSize` defaults mean clients may omit them; logs may show defaults for “missing” query keys.

On Web routes prefer `body` / `query` over hand `validate` + custom 400—types and error envelopes stay aligned.

Error message language follows app `language`—see [Web](/en/web/#language) · [Console](/en/console/#language).

## Next steps

- [Manual validation](./validate) (same schema in scripts and tests)
- [object](./rules/object) / [array](./rules/array) / [oneOf](./rules/one-of)
- [Request body](/en/web/body) / [Query string](/en/web/query)