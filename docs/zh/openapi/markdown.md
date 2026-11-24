---
outline: deep
---

# Markdown 文案

OpenAPI 里不少 **description** 字段按 **CommonMark** 渲染（Swagger UI / Redoc 都会解析）。aomex 不单独发明语法：你在字符串里写 Markdown，生成进 Document 后由文档站展示。

适合写：接口背景、鉴权说明、分页约定、错误码表。`summary` 仍建议保持**一行短标题**——侧栏和列表主要看它。

## 在 generateOpenapi 里写

整站说明放 `docs.info.description`；分组说明放 `docs.tags[].description`（与路由上的 tag 名对应，见 [Tags 分组](/zh/openapi/tags)）。

```typescript
import { generateOpenapi } from '@aomex/openapi-generator';
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

模板字符串里的换行会进 Document；表格、标题、加粗、行内代码在 Redoc 里通常比 Swagger 更易读。链接用普通 Markdown 链接即可。

::: tip
Console 落盘（`openapi()` / `aomex openapi`）同样接收 `docs`，字段与这里一致，只是结果写成文件。
:::

## 在路由里写

单条 operation 的长说明写在方法级 `docs.description`；`summary` 给列表用的短句。Router 级也可写 `deprecated` 等，与方法级浅合并。

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

`response({ description })`、以及验证器上的 `rule.*.docs({ description })`，同样可以写短 Markdown（参数说明里少用复杂表格，侧栏空间有限）。

```typescript
query({
  page: rule.int().min(1).default(1).docs({
    description: '页码，从 **1** 起', // [!code highlight]
  }),
}),
```

## 写的时候注意

| 场景 | 建议 |
| --- | --- |
| 侧栏标题 | 用 `summary`，别塞换行 |
| 操作说明 / 示例请求 | `docs.description` |
| 全站约定 | `generateOpenapi` → `docs.info.description` |
| 分组导读 | `docs.tags[].description` |
| 代码围栏 | 模板字符串里写 \`\`\`；别和外层 TypeScript fence 打架时可改用缩进代码块 |

改完文案后重新 `generateOpenapi` 或刷新动态 Swagger / Redoc，才能看到渲染结果。静态 `openapi.json` 模式还要再跑一遍 [生成OpenAPI](/zh/openapi/)。

## 下一步

- [Tags 分组](/zh/openapi/tags)：名字从哪来、怎么覆盖
- [生成OpenAPI](/zh/openapi/)：扫路由与传入 `app`
- [Swagger UI](/zh/openapi/swagger-ui) · [Redoc UI](/zh/openapi/redoc-ui)：预览 Markdown 效果
