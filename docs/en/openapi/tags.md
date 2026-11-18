---
outline: deep
---

# Tags

OpenAPI uses **tags** to group operations in the sidebar (the left column in Swagger / Redoc). When aomex scans routes, it attaches tags to each operation; if you omit them, the default is the **route file name** (extension stripped).

## Set tags once on the Router

For every route in the same file and business domain, write tags once on `new Router`—they are shallow-merged into each route’s `docs`:

```typescript
import { Router } from '@aomex/web';

export const router = new Router({ // [!code focus:4]
  prefix: '/users',
  docs: { tags: ['User'] }, // [!code highlight]
});

router.get('/', {
  docs: { summary: '用户列表' },
  action: async (ctx) => {
    ctx.send([]);
  },
});

router.get('/:id', {
  docs: { summary: '用户详情' },
  action: async (ctx) => {
    ctx.send({ id: 1 });
  },
});
```

Both routes appear under the **User** group in the docs. When the file is `user.router.ts` and you skip tags, the default tag is `user.router`—hard to read; for domain router files, set tags explicitly.

## Override or extend tags on a single route

Method-level `docs` and Router-level `docs` are **shallow-merged** (later wins). If you only change `summary`, Router-level `tags` stay; if the method also sets `tags`, they **fully replace** Router tags—arrays are not merged.

```typescript
export const router = new Router({
  prefix: '/orders',
  docs: { tags: ['Order'] },
});

router.get('/export', {
  docs: { // [!code focus:4]
    tags: ['Order', 'Export'], // [!code highlight]
    summary: '导出订单',
  },
  action: async (ctx) => {
    ctx.send('ok');
  },
});
```

For cross-domain endpoints (both order and export), list multiple names in the same `tags` array.

## Descriptions for tags themselves

`tags: ['User']` on routes only contributes the **name**. To add an intro blurb at the top of a group in the docs (Markdown supported), declare matching entries under `docs.tags` in `generateOpenapi`:

```typescript
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

await generateOpenapi({
  routers: './src/routers',
  app,
  docs: { // [!code focus:12]
    info: { title: 'My API', version: '1.0.0' },
    tags: [
      {
        name: 'User',
        description: '用户与资料。\n\n- 列表分页从 **1** 起\n- 详情 404 表示不存在', // [!code highlight]
      },
      { name: 'Order', description: '下单与履约' },
    ],
  },
});
```

After generation, the framework **auto-adds** tag names used in routes but missing from `docs.tags` into `document.tags` (`name` only, no description). To control copy or ordering, declare all common groups in `docs.tags` up front.

For longer Markdown (headings, lists, links), see [Markdown copy](/en/openapi/markdown).

## With showInOpenapi

Set `docs: { showInOpenapi: false }` on routes that should not appear in the contract (for example a custom `/openapi.json`). Their tags are not in the used list, so you will not get an empty group from them alone.

## Next steps

- [Markdown copy](/en/openapi/markdown): long-form copy in `info` / route `description`
- [Generate OpenAPI](/en/openapi/): `generateOpenapi` and `app`
- [Swagger UI](/en/openapi/swagger-ui) · [Redoc UI](/en/openapi/redoc-ui): see grouping in the browser