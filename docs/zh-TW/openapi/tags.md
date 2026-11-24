---
outline: deep
---

# Tags 分組

OpenAPI 用 **tag** 把介面分到側欄分組（Swagger / Redoc 左側那一列）。aomex 掃路由時會給每條 operation 掛上 tags；你沒寫時，預設用**路由檔名**（去掉副檔名）。

## 在 Router 上統一打標籤

同一檔案、同一業務域的介面，在 `new Router` 上寫一次即可——會淺合併進該檔案裡每條路由的 `docs`：

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

兩條路由在文件裡都會落在 **User** 分組下。檔名是 `user.router.ts` 時，若不寫 tags，預設 tag 是 `user.router`——可讀性差，業務域檔案建議顯式寫上。

## 單條路由覆蓋或追加域

方法級 `docs` 與 Router 級是**淺合併**（後寫覆蓋先寫）。只改 `summary` 時，Router 上的 `tags` 會保留；若方法上也寫了 `tags`，則**整份替換** Router 的 tags，不會自動數組合並。

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

跨域介面（既算訂單又算匯出）把多個名字寫進同一個 `tags` 陣列即可。

## 給 tag 本身寫說明

路由上的 `tags: ['User']` 只貢獻**名字**。要在文件頂部給分組加一段介紹（支援 Markdown），在 `generateOpenapi` 的 `docs.tags` 裡宣告同名項：

```typescript
import { generateOpenapi } from '@aomex/openapi-generator';
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

生成結束後，框架會把路由裡用到、但 `docs.tags` 尚未宣告的名字**自動補進** `document.tags`（只有 `name`、沒有 description）。想控制分組文案或排序，在 `docs.tags` 裡先寫全常用分組。

更長的 Markdown 寫法（標題、列表、連結）見 [Markdown 文案](/zh-TW/openapi/markdown)。

## 和 showInOpenapi

某條路由不進契約時設 `docs: { showInOpenapi: false }`（例如自建 `/openapi.json`）。它的 tags 不會出現在 used 列表裡，也就不會因它多出一個空分組。

## 下一步

- [Markdown 文案](/zh-TW/openapi/markdown)：`info` / 路由 `description` 怎麼寫長文
- [生成OpenAPI](/zh-TW/openapi/)：`generateOpenapi` 與 `app`
- [Swagger UI](/zh-TW/openapi/swagger-ui) · [Redoc UI](/zh-TW/openapi/redoc-ui)：瀏覽器裡看分組效果
