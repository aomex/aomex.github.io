---
outline: deep
---

# Markdown copy

Many OpenAPI **description** fields render as **CommonMark** (Swagger UI and Redoc both parse it). aomex does not invent its own syntax: you write Markdown in strings; after generation the doc site renders it.

Good for: endpoint background, auth notes, pagination rules, error code tables. Keep **`summary` as a one-line title**—sidebars and lists rely on it.

## In generateOpenapi

Put site-wide copy in `docs.info.description`; group intros in `docs.tags[].description` (names must match route tags—see [Tags](/en/openapi/tags)).

```typescript
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

await generateOpenapi({
  routers: './src/routers',
  app,
  docs: { // [!code focus:18]
    info: {
      title: 'My API',
      version: '1.0.0',
      description: `
面向内部服务的 HTTP API。

## 鉴权

除标注为公开的接口外，请带 \`Authorization: Bearer <token>\`。

## 约定

| 项 | 说明 |
| --- | --- |
| 分页 | \`page\` 从 **1** 起 |
| 时间 | ISO-8601，UTC |
`, // [!code highlight]
    },
    tags: [
      {
        name: 'User',
        description: '用户域。\n\n详见 [用户模型](https://wiki.example.com/user)。',
      },
    ],
  },
});
```

Newlines in template literals end up in the Document; tables, headings, bold, and inline code often read better in Redoc than in Swagger. Use normal Markdown links.

::: tip
Console export (`openapi()` / `aomex openapi`) accepts the same `docs` fields; only the output goes to a file.
:::

## On routes

Long operation text goes in method-level `docs.description`; `summary` is the short line for lists. Router-level fields such as `deprecated` shallow-merge with method-level docs.

```typescript
import { response, Router } from '@aomex/web';
import { rule } from '@aomex/common';

export const router = new Router({
  prefix: '/users',
  docs: { tags: ['User'] },
});

router.get('/:id', { // [!code focus:22]
  docs: {
    summary: '用户详情',
    description: `
按主键取用户。

- 存在 → **200** + 用户对象
- 不存在 → **404**（见全局错误格式）

\`\`\`
GET /users/42
\`\`\`
`, // [!code highlight]
  },
  mount: [
    response({
      statusCode: 200,
      description: '找到用户；body 为资料字段',
      content: { id: rule.int(), name: rule.string() },
    }),
    response({ statusCode: 404, description: '用户不存在' }),
  ],
  action: async (ctx) => {
    // …
  },
});
```

`response({ description })` and `rule.*.docs({ description })` can use short Markdown too (avoid heavy tables in parameter help—the sidebar is tight).

```typescript
query({
  page: rule.int().min(1).default(1).docs({
    description: '页码，从 **1** 起', // [!code highlight]
  }),
}),
```

## While writing

| Scenario | Suggestion |
| --- | --- |
| Sidebar title | Use `summary`; no line breaks |
| Operation text / sample request | `docs.description` |
| Site-wide rules | `generateOpenapi` → `docs.info.description` |
| Group intro | `docs.tags[].description` |
| Code fences | Use \`\`\` inside template literals; or indented blocks if they clash with the outer TypeScript fence |

After changing copy, run `generateOpenapi` again or refresh dynamic Swagger / Redoc to see rendering. Static `openapi.json` also needs another pass through [Generate OpenAPI](/en/openapi/).

## Next steps

- [Tags](/en/openapi/tags): where names come from and how to override
- [Generate OpenAPI](/en/openapi/): scan routes and pass `app`
- [Swagger UI](/en/openapi/swagger-ui) · [Redoc UI](/en/openapi/redoc-ui): preview Markdown