---
outline: deep
---

# 错误格式

让全站（或某个模块）的 ctx.throw 变成统一的 JSON 信封，而不是默认纯文本：在 mount 上挂 formatError，用 handler 决定最终 body，用 content 锁定类型和 OpenAPI。改形状走这里，别在 app.on('error') 里硬改 body——时机晚，容易和已写出的响应打架。

```typescript
import { rule } from '@aomex/common';
import { formatError, routers, WebApp } from '@aomex/web';

new WebApp({
  // services / logger / language / proxyIP —— 见 [应用入口](/zh/web/)
  mount: [
    formatError({ // [!code focus:13]
      content: { // [!code highlight]
        code: rule.string(),
        message: rule.string(),
      },
      handler(err) {
        return {
          code: err.code ?? 'ERROR',
          message: err.message,
        };
      },
    }),
    routers('./src/routers'),
  ],
});
```

把 `formatError` 挂在 routers **外面、靠前**，这样任意路由里 throw，只要没被更内层接住，都会进这个 handler。

handler 返回值形状要对齐 content；`ctx.throw(403, { code: 'FORBIDDEN' })` 时业务码多在 err.code，文案在已净化的 err.message。省略 statusCodes 时，这一层接管**全部** 4xx / 5xx。路由上 `response({ statusCode: 400 })` 且没写 content 时，生成文档往往会借用外层 formatError 的错误形状。不挂 formatError 时，客户端仍是框架默认的纯文本错误。

接手时一般会清掉当前响应上已有的头，再按错误码重设状态并 send 新 body。别把 err.raw、堆栈、SQL 写进 handler 返回值——对外只给净化后的信息。

## 模块内层信封

全局 formatError 管整站默认形状；**/admin** 或开放 API 子域若要另一套字段名（`error` / `detail` 而不是 `code` / `message`），在对应 `Router({ mount: [formatError(...)] })` 里再挂一层。洋葱内侧先接住 throw，该前缀下的路由走内层信封，其它路径仍用外层。

/admin 要另一套字段名时，在 Router 内再挂一层：

```typescript
import { formatError, Router } from '@aomex/web';

const adminRouter = new Router({ // [!code focus:18]
  prefix: '/admin',
  mount: [
    formatError({ // [!code highlight]
      content: {
        error: rule.string(),
        detail: rule.string().optional(),
      },
      handler(err) {
        return {
          error: err.code ?? 'ADMIN_ERROR',
          detail: err.message,
        };
      },
    }),
    auth.authenticate('bearer'),
  ],
});
```

洋葱里**内侧先 catch**：/admin/* 走内层形状，其它路由继续用全局兜底。

## statusCodes 局部接管

`statusCodes` 限定**这一层** formatError 只处理列出的 HTTP 状态码（常见只包 400、422 等校验类）。其它 4xx / 5xx 继续冒泡到外层 handler，适合「校验错误统一 JSON、业务 403 仍走全局信封」的分工。

只想管校验类错误，其它码交给外层：

```typescript
formatError({ // [!code highlight]
  statusCodes: [400, 422],
  content: {
    code: rule.string(),
    message: rule.string(),
  },
  handler(err) {
    return {
      code: err.code ?? 'VALIDATION',
      message: err.message,
    };
  },
}),
```

## 和路由 throw 配合

路由里用 `ctx.throw(status, …)` 主动结束请求并走错误链：缺资源 **404**、参数业务校验 **400**、权限 **403** 等。第二参可以是字符串或带 `code` 的对象，formatError 的 handler 从 `err` 上取码和文案拼进 content。

```typescript
ctx.throw(404);
ctx.throw(400, 'name required');
ctx.throw(403, { code: 'FORBIDDEN' });
```

业务里若已误写过头或 body 再 throw，交给 formatError 整份替换即可，别在 action 里拼一半错误 JSON。

若还要把成功体和错误体再包进同一层 `{ success, data, statusCode }`、外层 HTTP 固定 200，见 [响应体套壳](/zh/web/envelope)（常与 formatError 一起配）。

## 下一步

- [响应体套壳](/zh/web/envelope)（统一外壳与 HTTP 200）
- [约束响应](/zh/web/response)（每条路由声明 400/404 等）
- [应用入口](/zh/web/)（services / logger / language 等全局配置）
- [WebApp.language](/zh/web/#language)（校验与错误文案语言）