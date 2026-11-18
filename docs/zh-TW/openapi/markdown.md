---
outline: deep
---

# Markdown 文案

OpenAPI 裡不少 **description** 欄位按 **CommonMark** 渲染（Swagger UI / Redoc 都會解析）。aomex 不單獨發明語法：你在字串裡寫 Markdown，生成進 Document 後由文件站展示。

適合寫：介面背景、鑑權說明、分頁約定、錯誤碼錶。`summary` 仍建議保持**一行短標題**——側欄和列表主要看它。

## 在 generateOpenapi 裡寫

整站說明放 `docs.info.description`；分組說明放 `docs.tags[].description`（與路由上的 tag 名對應，見 [Tags 分組](/zh-TW/openapi/tags)）。

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

模板字串裡的換行會進 Document；表格、標題、加粗、行內程式碼在 Redoc 裡通常比 Swagger 更易讀。連結用普通 Markdown 連結即可。

::: tip
Console 落盤（`openapi()` / `aomex openapi`）同樣接收 `docs`，欄位與這裡一致，只是結果寫成檔案。
:::

## 在路由裡寫

單條 operation 的長說明寫在方法級 `docs.description`；`summary` 給列表用的短句。Router 級也可寫 `deprecated` 等，與方法級淺合併。

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

`response({ description })`、以及驗證器上的 `rule.*.docs({ description })`，同樣可以寫短 Markdown（引數說明裡少用複雜表格，側欄空間有限）。

```typescript
query({
  page: rule.int().min(1).default(1).docs({
    description: '页码，从 **1** 起', // [!code highlight]
  }),
}),
```

## 寫的時候注意

| 場景 | 建議 |
| --- | --- |
| 側欄標題 | 用 `summary`，別塞換行 |
| 操作說明 / 示例請求 | `docs.description` |
| 全站約定 | `generateOpenapi` → `docs.info.description` |
| 分組導讀 | `docs.tags[].description` |
| 程式碼圍欄 | 模板字串裡寫 \`\`\`；別和外層 TypeScript fence 打架時可改用縮排程式碼塊 |

改完文案後重新 `generateOpenapi` 或重新整理動態 Swagger / Redoc，才能看到渲染結果。靜態 `openapi.json` 模式還要再跑一遍 [生成OpenAPI](/zh-TW/openapi/)。

## 下一步

- [Tags 分組](/zh-TW/openapi/tags)：名字從哪來、怎麼覆蓋
- [生成OpenAPI](/zh-TW/openapi/)：掃路由與傳入 `app`
- [Swagger UI](/zh-TW/openapi/swagger-ui) · [Redoc UI](/zh-TW/openapi/redoc-ui)：預覽 Markdown 效果
