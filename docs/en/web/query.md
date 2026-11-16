---
outline: deep
---

# Query string

Declare `?page=1&keyword=` parameters for GET (or other verbs with query): mount `query()` on the route with [validators](/en/validators/). After validation use `ctx.query` in the action; failures → **400**, action does not run.

```typescript
import { rule } from '@aomex/common';
import { query, Router } from '@aomex/web';

export const router = new Router();

router.get('/users', { // [!code focus:13]
  mount: [
    query({ // [!code highlight]
      page: rule.int().min(1).default(1),
      size: rule.int().min(5).max(50).default(10),
      keyword: rule.string().optional(),
    }),
  ],
  action: async (ctx) => {
    const { page, size, keyword } = ctx.query;
    ctx.send({ page, size, keyword, items: [] });
  },
});
```

Example: `GET /users?page=2&size=20&keyword=ada`.

With `query()`, `ctx.query` only has declared keys; `default()` makes missing params typed as required values (e.g. `page` is always `number`). `optional()` fields include `undefined`. Without `query()`, only wider types like `ctx.request.query` exist—do not treat them as validated. Validation failure skips the action with **400**.

Do not hand-roll `Number(ctx.request.query.page)`—breaks OpenAPI and error shaping, and types will not narrow.

## Reuse list schemas

When many list endpoints share `page` / `size` / `q`, put query fields in `src/schemas/*.schema.ts` and `query(listQuerySchema)` on routes. Change caps or defaults in one place; OpenAPI follows the same descriptions.

```typescript
// src/schemas/list-query.schema.ts
import { schema, rule } from '@aomex/common';

export const listQuerySchema = schema({
  page: rule.int().min(1).default(1),
  size: rule.int().max(100).default(20),
  q: rule.string().trim().optional(),
});
```

```typescript
// src/routers/user.ts
import { query, Router } from '@aomex/web';
import { listQuerySchema } from '../schemas/list-query.schema.js';

const router = new Router();

router.get('/users', { // [!code focus:6]
  mount: [query(listQuerySchema)], // [!code highlight]
  action: async (ctx) => {
    const { page, size, q } = ctx.query;
    ctx.send(await searchUsers({ page, size, q }));
  },
});
```

Enum sort field:

```typescript
sort: rule.enum(['name', 'createdAt'] as const).default('createdAt'),
```

OpenAPI notes on rules or routes:

```typescript
page: rule.int().min(1).docs({ description: 'Page number, starts at 1' }),
```

## vs body / params

Keep roles separate: **query** for filters and pagination (idempotent GET), **params** for resource ids in the path, **body** for create/update entities. Mixing them breaks cache, logs, and OpenAPI semantics.

| Source | Typical use |
| --- | --- |
| **query** | Filter, pagination, sort—idempotent GET |
| **params** | Resource ID in the path |
| **body** | POST / PUT / PATCH entity |

Huge JSON filters in query blow URL length and cache keys—consider POST + `body()` and accept non-idempotent GET caching. Creating via POST but stuffing large JSON into query also breaks conventions.

::: tip
List UIs often send extra tracking params—avoid overly strict or unnecessary required query fields or B2B integrations hit 400. `default()` types defaults in, but access logs may not show `?page=1` in the raw URL.
:::

## Next steps

- [Path parameters](/en/web/params)
- [Request body](/en/web/body)
- [Validator chains](/en/validators/chain): default, optional, transform