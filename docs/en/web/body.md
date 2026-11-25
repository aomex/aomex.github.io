---
outline: deep
---

# Request body

Describe JSON or form bodies for POST / PUT / PATCH: mount `body()` with validators. After validation `ctx.body` narrows; bad shape → **400**, oversized payload → **413** (configure `body.payload` / `body.formData` on [Web app entry](/en/web/)).

```typescript
import { rule } from '@aomex/common';
import { body, Router } from '@aomex/web';

export const router = new Router();

router.post('/users', { // [!code focus:13]
  mount: [
    body({ // [!code highlight]
      username: rule.string().length({ min: 2, max: 32 }),
      age: rule.int().min(0).max(150).optional(),
    }),
  ],
  action: async (ctx) => {
    const { username, age } = ctx.body;
    ctx.send(201, { username, age });
  },
});
```

Common `Content-Type`: `application/json`, `application/x-www-form-urlencoded`, `text/*`; `rule.file()` triggers `multipart/form-data` parsing.

After `body({ username: rule.string(), age: rule.int().optional() })`, `ctx.body.username` is `string`, `age` is `number | undefined`. `body(createPostSchema.partial())` for PATCH makes fields optional with the same rules. Root `body(rule.array(...))` or `body(rule.oneOf([...]))` types `ctx.body` as the whole array or union. Without `body()`, do not treat `ctx.body` as validated input.

Do not read the request stream yourself for `JSON.parse`—conflicts with framework-parsed `ctx.body` and bypasses quotas.

## App-level JSON cap

`WebApp.body.payload.maxSize` limits **site-wide** JSON / text body size; oversize payloads fail with **413** before `body()` validation. Set this on public APIs and webhooks—route schemas cannot stop “cannot parse at all”.

```typescript
import { logger } from '@/services/logger.service';

new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  body: { // [!code focus:3]
    payload: { maxSize: '1mb' }, // [!code highlight]
  },
  mount: [routers('./src/routers')],
});
```

## Root-level array body

Some clients send a **root JSON array** (batch IDs, event lists) instead of `{ items: [...] }`. Pass `rule.array(...)` or a full schema to `body()`—`ctx.body` becomes an array type.

```typescript
router.post('/batch-delete', {
  mount: [body(rule.array(rule.int()))], // [!code highlight]
  action: async (ctx) => {
    ctx.send({ deleted: ctx.body.length });
  },
});
```

## oneOf discriminated shapes

One URL may accept several JSON shapes branched by `type`, but only one at a time. `rule.oneOf([...])` tries branches in order—exactly one must pass; two matches or none → **400**.

```typescript
router.post('/events', { // [!code focus:13]
  mount: [
    body( // [!code highlight]
      rule.oneOf([
        rule.object({ type: rule.literal('a'), a: rule.int() }),
        rule.object({ type: rule.literal('b'), b: rule.string() }),
      ]),
    ),
  ],
  action: async (ctx) => {
    ctx.send({ ok: true });
  },
});
```

## Create and PATCH

Create with the full schema; partial updates with `.partial()` on the same schema—PATCH fields optional, rules shared with POST. After extracting to `src/schemas/*.schema.ts`, routes import one definition.

```typescript
// src/schemas/post.schema.ts
import { schema, rule } from '@aomex/common';

export const createPostSchema = schema({
  title: rule.string(),
  content: rule.string(),
});
```

```typescript
import { body } from '@aomex/web';
import { createPostSchema } from '@/schemas/post.schema';

router.post('/posts', { // [!code focus:6]
  mount: [body(createPostSchema)], // [!code highlight]
  action: async (ctx) => {
    ctx.send(201, await createPost(ctx.body));
  },
});

router.patch('/posts/:id', {
  mount: [body(createPostSchema.partial())], // [!code highlight]
  action: async (ctx) => {
    ctx.send(await patchPost(ctx.params.id, ctx.body));
  },
});
```

::: warning
Under `partial()`, `{}` can pass—if you require “at least one field”, check in the action. Missing `Content-Type` may yield `{}`; all-optional schemas silently “change nothing”.
:::

## With files

Avatars and attachments use `rule.file()`—see [File uploads](/en/web/attach):

```typescript
router.post('/avatar', { // [!code focus:12]
  mount: [
    body({
      name: rule.string(),
      avatar: rule.file().maxSize('2mb').mimeTypes('image/*'), // [!code highlight]
    }),
  ],
  action: async (ctx) => {
    const { avatar } = ctx.body;
    await saveAvatar(avatar);
    ctx.send({ ok: true });
  },
});
```

| Pattern | Result |
| --- | --- |
| `{ avatar: rule.file() }` | Single file, field name = form `name` |
| `{ photos: rule.array(rule.file()).length({ max: 5 }) }` | Multiple parts same name, max 5 |
| Nested object with `rule.file()` | Usually mismatches flat multipart field names |

Field `maxSize` and app `formData` limits use the **stricter**; on **413** check both layers.

Large filters via POST + `body()` need clear docs and cache policy—do not promise GET semantics.

## Next steps

- [File uploads](/en/web/attach)
- [Response constraints](/en/web/response)
- [Web app entry](/en/web/): site-wide body quotas