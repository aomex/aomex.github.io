---
outline: deep
---

# Manual validation

Outside Web routes, run arbitrary data through rules: unit tests, scripts, your own middleware. Web `body()` / `query()` uses the same engine underneath—here you call `validate` yourself.

```typescript
import { validate } from '@aomex/common';
import { createUserSchema } from '@/schemas/user.schema';

const input = { name: 'Ada', email: 'ada@example.com' };

const user = await validate(input, createUserSchema); // [!code highlight]
// success: user is the inferred type
// failure: throws (default)
```

`mount: [body(createUserSchema)]` on a route is the same “stop on failure” posture, with errors shaped as HTTP 400.

`validate` only checks shape; stock, permissions, duplicate signup stay in service / action.

`validate` returns a Promise—forgetting `await` passes a Promise through as data.

- First argument is wide (`unknown`, config, fixtures); success narrows to `Validator.Infer<typeof schema>`.
- Default `throwOnError: true`: on failure there is **no** usable return value—catch or let it bubble.
- With `{ throwOnError: false }` you get `{ data, errors }`; **success means `errors === null`**—do not use `data === null` as failure; with `nullable()` a legal value can be `null`.

::: warning
Judging failure with `data === null` mis-fires when a nullable field passes as `null`.
:::

- On failure with `throwOnError: false`, `errors` is usually `string[]`—good for showing every form error at once.

| Pattern | When to use |
| --- | --- |
| `await validate(input, schema)` | Scripts, tests, middleware—stop on failure |
| `validate(input, schema, { throwOnError: false })` | Admin forms—show **all** errors together |
| Same `schema` + `validate` / `body()` | Rules maintained in one place |

### Collect errors without throwing

```typescript
import { validate } from '@aomex/common';
import { createUserSchema } from '@/schemas/user.schema';

const input = { name: '', email: 'not-email' };

const result = await validate(input, createUserSchema, { throwOnError: false }); // [!code highlight]

if (result.errors === null) {
  await db.user.create(result.data);
} else {
  return { ok: false, errors: result.errors };
}
```

### vs routes

**HTTP entry** uses body / query / params; **config reads, pre-Cron checks, test fixtures** use `validate`. Rules live in `src/schemas/`.

Hand-rolling `validate` + `throw(400)` everywhere duplicates work and scatters OpenAPI—mount middleware when you can.

## Next steps

- [schema](./schema)
- [Common chains](./chain) (narrow per field)
- [Error format](/en/web/errors) (JSON envelope after throws on Web)