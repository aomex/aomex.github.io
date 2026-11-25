---
outline: deep
---

# Path parameters

After a route like `/users/:id` matches, segments land in `ctx.request.params` as **strings**. Use `params()` in `mount` for type and range checks; use clean `ctx.params` in the action. Bad shape → **400**; missing resource → **404**.

```typescript
import { rule } from '@aomex/common';
import { params, Router } from '@aomex/web';

export const router = new Router();

router.get('/users/:id', { // [!code focus:15]
  mount: [
    params({ // [!code highlight]
      id: rule.int().min(1),
    }),
  ],
  action: async (ctx) => {
    const { id } = ctx.params;
    const user = await findUser(id);
    if (!user) {
      ctx.throw(404, 'user not found');
    }
    ctx.send(user);
  },
});
```

`:id` matching any string does not make a valid ID—ranges and UUIDs belong in validators. Wrong shape → **400**; not found → **404**, or monitoring treats typos as missing resources.

After `params({ id: rule.int().min(1) })`, `ctx.params.id` is `number`. Template `:userId` must match schema key `userId`. Without `params()`, only strings—`"42"` vs `42` confuses business logic. If the path never matched a route, `params()` does not run—that is 404, not validation 400.

`:userId` in the path but `params({ id: ... })` misaligns keys. Do not duplicate `id` in query and prefer query—path/query mismatch breaks cache, auth, and logs.

## UUID and multi-segment paths

For public UUID ids use `rule.uuid()` so arbitrary strings are not valid primary keys. Multiple placeholders (`/users/:userId/posts/:postId`) belong in one `params({ ... })` with keys matching the template.

```typescript
params({ id: rule.uuid() }),
```

```typescript
router.get('/users/:userId/posts/:postId', { // [!code focus:12]
  mount: [
    params({ // [!code highlight]
      userId: rule.int().min(1),
      postId: rule.int().min(1),
    }),
  ],
  action: async (ctx) => {
    const { userId, postId } = ctx.params;
    ctx.send({ userId, postId });
  },
});
```

## Reusable param schemas

When `:id` repeats across routes, extract the `params` shape to a schema file—same pattern as [body / query reuse](/en/web/body). Change ID rules (int → uuid) in one place.

```typescript
// src/schemas/user-id-param.schema.ts
import { schema, rule } from '@aomex/common';

export const userIdParamSchema = schema({
  id: rule.uuid(),
});
```

```typescript
import { params } from '@aomex/web';
import { userIdParamSchema } from '@/schemas/user-id-param.schema';

router.get('/users/:id', { // [!code focus:5]
  mount: [params(userIdParamSchema)], // [!code highlight]
  action: async (ctx) => {
    ctx.send(await findUser(ctx.params.id));
  },
});
```

With `params()` mounted, OpenAPI path parameters get `in: path` and `required` automatically.

## Next steps

- [Query string](/en/web/query)
- [Request body](/en/web/body)
- [HTTP routing](/en/web/router): static paths alongside `:id`