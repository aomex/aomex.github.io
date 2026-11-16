---
outline: deep
---

# Mongoose

MongoDB pain point: **one validator set for HTTP, another hand-written Mongoose Schema**—fields drift on change. `defineMongooseModel` builds Mongoose Schema from the same `rule`s as routes, extending `ObjectId` / `Decimal128` validation—this page ties model definition, HTTP, and types.

Complex indexes, Mongoose middleware, DB-only fields still belong on the model or route `response`; the bridge does not replace all Mongoose config.

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

Load Mongo rules before use (adjust entry path):

```typescript
import { rule } from '@aomex/common';
import '@aomex/mongoose';

rule.mongoObjectId();
rule.mongoDecimal128();
```

Typical layers (not middleware):

1. `models/user.ts` — `defineMongooseModel`
2. `schemas/user.schema.ts` — shared input/output schemas
3. `routers/user.ts` — `body` / `response` from schemas
4. `web.ts` — normal `WebApp` + routers

```typescript
import { body, response } from '@aomex/web';
import { userBodySchema } from '../schemas/user.schema.js';

router.post('/users', {
  mount: [body(userBodySchema)], // [!code highlight]
  response: { content: { /* public DTO—do not leak DB-only fields */ } },
  action: async (ctx) => {
    await User.create(ctx.body);
    ctx.send({ ok: true });
  },
});
```

`defineMongooseModel` returns a standard Mongoose Model with **input/output** inference—hover document fields when creating/querying. Nested objects in `schemas` become object validators like route `body({ ... })`. `rule.mongoObjectId()` etc. appear on `rule` only **after** `import '@aomex/mongoose'`. `formatMongoResult` tidies query results for JSON (`_id`, `Decimal`, etc.)—follow package exports and types.

## Model fields vs public DTO

| Field / option | When to use |
| --- | --- |
| `schemas` | field → Validator or nested object |
| `indexes` | `{ fields, ...IndexOptions }[]` |
| `timestamps` / `versionKey` | Same as Mongoose SchemaOptions |
| Other SchemaOptions | Pass through to Mongoose |
| Route `response({ content })` | Public DTO; DB-only fields not in API by default |

Different from [Prisma](/en/plugins/prisma)—Mongoose + Mongo, not `definePrismaSchema`.

Defining only the model but hand-writing another shape on routes defeats shared `rule`. Do not `ctx.send` raw Mongoose documents—sensitive/DB fields leak; use `response` or explicit pick. Unique compound indexes, `pre` hooks, etc. stay on the model.

## Related

- Custom Mongo rules: [Custom validators](/en/advanced/validator) (`mongoObjectId` same pattern)
- HTTP input: [Request body](/en/web/body)
- Validator list: [builtins](/en/validators/builtins)