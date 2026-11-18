---
outline: deep
---

# Tags 分组

OpenAPI 用 **tag** 把接口分到侧栏分组（Swagger / Redoc 左侧那一列）。aomex 扫路由时会给每条 operation 挂上 tags；你没写时，默认用**路由文件名**（去掉扩展名）。

## 在 Router 上统一打标签

同一文件、同一业务域的接口，在 `new Router` 上写一次即可——会浅合并进该文件里每条路由的 `docs`：

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

两条路由在文档里都会落在 **User** 分组下。文件名是 `user.router.ts` 时，若不写 tags，默认 tag 是 `user.router`——可读性差，业务域文件建议显式写上。

## 单条路由覆盖或追加域

方法级 `docs` 与 Router 级是**浅合并**（后写覆盖先写）。只改 `summary` 时，Router 上的 `tags` 会保留；若方法上也写了 `tags`，则**整份替换** Router 的 tags，不会自动数组合并。

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

跨域接口（既算订单又算导出）把多个名字写进同一个 `tags` 数组即可。

## 给 tag 本身写说明

路由上的 `tags: ['User']` 只贡献**名字**。要在文档顶部给分组加一段介绍（支持 Markdown），在 `generateOpenapi` 的 `docs.tags` 里声明同名项：

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

生成结束后，框架会把路由里用到、但 `docs.tags` 尚未声明的名字**自动补进** `document.tags`（只有 `name`、没有 description）。想控制分组文案或排序，在 `docs.tags` 里先写全常用分组。

更长的 Markdown 写法（标题、列表、链接）见 [Markdown 文案](/zh/openapi/markdown)。

## 和 showInOpenapi

某条路由不进契约时设 `docs: { showInOpenapi: false }`（例如自建 `/openapi.json`）。它的 tags 不会出现在 used 列表里，也就不会因它多出一个空分组。

## 下一步

- [Markdown 文案](/zh/openapi/markdown)：`info` / 路由 `description` 怎么写长文
- [生成OpenAPI](/zh/openapi/)：`generateOpenapi` 与 `app`
- [Swagger UI](/zh/openapi/swagger-ui) · [Redoc UI](/zh/openapi/redoc-ui)：浏览器里看分组效果
