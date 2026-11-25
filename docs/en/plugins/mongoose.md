---
outline: deep
---

# Mongoose

A common pain in MongoDB projects: **one validation set for HTTP input, another hand-written Mongoose Schema**—change a field and both drift. `defineMongooseModel` builds a Mongoose Schema from the same `rule` chains as routes, and extends ObjectId / Decimal128 validation—this page ties model definition, HTTP wiring, and type expectations together.

Complex indexes, Mongoose middleware, and fields that exist only in the DB still need to be filled in on the model or route `response`; anything the bridge package does not cover goes back to Mongoose.

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

Mongo-specific rules need a side-effect import first (adjust the path for your project entry):

```typescript
import { rule } from '@aomex/common';
import '@aomex/mongoose';

rule.mongoObjectId();
rule.mongoDecimal128();
```

Typical layering (this package is **not** middleware):

1. models/user.ts — defineMongooseModel
2. schemas/user.schema.ts — shared input / output schemas
3. routers/user.ts — body / response reference the schema or field table
4. web.ts — normal WebApp + routers

```typescript
import { body, response } from '@aomex/web';
import { userBodySchema } from '@/schemas/user.schema';

router.post('/users', {
  mount: [body(userBodySchema)], // [!code highlight]
  response: { content: { /* public DTO—do not leak DB-only fields by default */ } },
  action: async (ctx) => {
    await User.create(ctx.body);
    ctx.send({ ok: true });
  },
});
```

`defineMongooseModel` returns a standard Mongoose Model with **input/output** inference—hovering document fields on create/query often lines up with the `rule` chain. Nested bare objects in `schemas` are folded into object validators automatically, same style as route `body({ ... })`. `rule.mongoObjectId()` and similar only appear on `rule` **after** `import '@aomex/mongoose'`; otherwise types and runtime diverge (forgetting the side-effect import skips registration). There is also `formatMongoResult`: reshape query results into a more JSON-friendly form (e.g. `_id`, Decimal)—use the package export and type hints.

## Model fields vs public DTOs

Fields in `schemas` become Validators (nested bare objects fold into object validators). `indexes`, `timestamps`, `versionKey`, and other SchemaOptions pass through to Mongoose—unique compound indexes, pre hooks, and anything validators cannot cover stay on the model layer.

Do not `ctx.send` a raw Mongoose document: sensitive or DB-only fields leak. Use `response({ content })` on the route or an explicit pick into a DTO.

Unlike [Prisma](/en/plugins/prisma): this is Mongoose + Mongo, not `definePrismaSchema`. Defining only the model while routes still hand-write another shape means field changes still hit two places—defeating the shared-`rule` goal.

## Related

- How custom Mongo rules are built: [Custom validators](/en/advanced/validator) (same pattern as mongoObjectId)
- HTTP input: [Request body](/en/web/body)
- Validator list: [builtins](/en/validators/builtins)
