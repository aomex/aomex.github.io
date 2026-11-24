---
outline: deep
---

# 响应体套壳

很多团队希望**成功和失败都走同一种 JSON 外壳**（例如 `{ success, data, statusCode }`），外层 HTTP 固定 **200**，真实业务码写在 body 里。`WebApp.envelope` 就是干这个的：在响应真正写出前，把原来的 body 和状态码按你声明的结构包一层。

路由里仍照常 `ctx.send(201, …)` / `ctx.throw(400, …)`；套壳发生在 flush 阶段，你不用在每个 action 手写外壳。

```typescript
import { rule } from '@aomex/common';
import { envelope, formatError, routers, WebApp } from '@aomex/web';

new WebApp({
  // services / logger / language / proxyIP —— 见 [应用入口](/zh/web/)
  envelope: { // [!code focus:7]
    content: {
      success: envelope.success, // [!code highlight]
      statusCode: envelope.statusCode,
      data: envelope.payload,
    },
  },
  mount: [
    formatError({
      content: { code: rule.string(), message: rule.string() },
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

配好之后：

- `ctx.send(201, { id: 1 })` → HTTP **200**，body 类似 `{ success: true, statusCode: 201, data: { id: 1 } }`
- `ctx.throw(400, …)`（配合 formatError）→ HTTP **200**，`success: false`，`data` 里是错误 JSON；真实 **400** 在 `statusCode` 槽

客户端要认 body 里的成功与否，**不能只看 HTTP 状态码**（重定向、无内容响应除外，见下文）。

## 内置槽位

`content` 是一棵声明树，叶子只能是内置槽或 `envelope.slot`，也可以嵌套普通对象。别直接塞 `rule.string()`——没有运行时取值来源。

| 槽位 | 运行时含义 |
| --- | --- |
| `envelope.success` | 原状态码是否 `< 400`（业务上算不算成功） |
| `envelope.payload` | 套壳前的响应 body（json / string / null） |
| `envelope.statusCode` | 套壳前的 HTTP 状态码（写出后外层仍是 200） |

字段名叫 `data`、`result` 还是 `payload` 由你定：把内置槽挂到哪个键上即可。

## 自定义槽与嵌套

需要版本号、追踪字段等固定或派生值时，用 `envelope.slot(schema, get)`：`schema` 给 OpenAPI；`get(vars, ctx)` 第一参是 `{ success, payload, statusCode }`，第二参是请求上下文（`WebContext` 加上 `WebApp.Props`，和 `onError` 能拿到的一样——pathname、headers、services 等）。

只要常量时，可以不写两个形参：

```typescript
envelope: {
  content: {
    meta: {
      ok: envelope.success,
      code: envelope.statusCode,
      version: envelope.slot(rule.string(), () => '1.0'), // [!code highlight]
    },
    result: envelope.payload,
  },
},
```

要从当前请求里取值时，用第二参 `ctx`：

```typescript
envelope: {
  content: {
    success: envelope.success,
    statusCode: envelope.statusCode,
    data: envelope.payload,
    path: envelope.slot(rule.string(), (_vars, ctx) => { // [!code highlight]
      return ctx.request.pathname;
    }),
  },
},
```

`get` 的返回值须对齐 `schema` 的推断类型；封闭对象上多写字段，类型会红。

## 和 formatError、response() 的关系

- **[formatError](/zh/web/errors)**：先把 `ctx.throw` 收成统一错误 JSON，再作为 `envelope.payload` 装进外壳。推荐一起配；不挂 formatError 时，默认纯文本错误也会进 payload（变成 JSON 字符串值）。
- **[response()](/zh/web/response)**：仍按「真实」状态码声明成功/失败体形状；套壳不改变你在 action 里怎么 send / throw，只改写出前的外壳。OpenAPI 里成败支会被收成 200 下的套壳 schema（见下）。需要某几个状态码**不套壳**时，在对应 `response({ skipEnvelope: true })` 上登记（下一节）。

业务代码继续写 `send(201)`、`throw(404)`，类型与路由声明不用改成「永远 200」。

::: tip
套壳时若 body 已是 JSON 字符串、且 `Content-Type` 为 `application/json`（例如中间件里手动 `JSON.stringify`），框架会先 `JSON.parse` 再填进 `envelope.payload`，避免 `data` 里变成一整段带转义的文本。
:::

## 不会套壳的情况

下列响应**原样写出**，不包外壳、也不改成 200：

| 情况 | 原因 |
| --- | --- |
| **3xx** 重定向 | Location 等语义不能改成 JSON 外壳 |
| **204 / 205 / 304** 等无内容状态码 | 本身没有 body |
| **SSE**（`text/event-stream`） | 流式帧协议，不能整包缓冲成一个 JSON |
| **Buffer / Stream** 体 | 二进制或流式下载，不适合套 JSON |

普通 json / string / null（含未显式 send 的默认 404）都会套。

配了 [ETag](/zh/plugins/etag) 时：一旦套壳改写 body，框架会**去掉原 ETag**，避免摘要还对应套壳前的内容。

## 主动跳过套壳

全站开了 envelope，个别出口仍要**裸响应**（下载页、兼容旧客户端、HTML 文档页等）时，有两种写法：

**业务路由优先用 `response({ skipEnvelope: true })`**：只跳过**这一条**声明里的 `statusCode`；其它状态码仍套壳。运行时与 OpenAPI 一致。

```typescript
import { rule } from '@aomex/common';
import { response, Router } from '@aomex/web';

export const router = new Router();

router.get('/export.csv', { // [!code focus:14]
  mount: [
    response({
      statusCode: 200,
      contentType: 'text/csv',
      content: rule.string(),
      skipEnvelope: true, // [!code highlight]
    }),
    response({ statusCode: 400 }),
  ],
  action: async (ctx) => {
    ctx.send(await buildCsv());
  },
});
```

上面这条：成功 200 是裸 CSV；校验失败的 400 仍走全站外壳（再经 formatError 进 payload）。

同一路由可多次挂 `response()`，各自决定要不要 `skipEnvelope`——例如成功套壳、错误裸出，或反过来。

**基础设施响应**（Swagger / Redoc 页、裸 OpenAPI JSON）可在 action 里设 `ctx.response.skipEnvelope = true`：无条件跳过本次写出，不论最终状态码。业务接口请优先用上面的 `response({ skipEnvelope })`，好让文档也登记到对应状态。

```typescript
action: async (ctx) => {
  ctx.response.skipEnvelope = true; // [!code highlight]
  ctx.send(rawOpenapiDocument);
},
```

## OpenAPI

给 `generateOpenapi` / Console `openapi()` 传入**配置了 envelope 的同一份 `WebApp`（`app`）**时，生成器会自动读 `app` 上的套壳配置：在其它 `response` / `formatError` 注入之后，把文档里的 2xx 与 4xx·5xx·default **收成 HTTP 200** 的套壳 schema（成败常用 `oneOf`，`success` 分别固定为 `true` / `false`）；**保留** 3xx、204 等无内容状态码，以及 `response({ skipEnvelope: true })` 登记过的状态码——和运行时跳过规则一致。

若同一 operation 既有「skip 的 200」又有需要套壳的成败支，生成器会在该 `200` 的 `application/json` 上把裸 schema 与套壳 schema 做成 `oneOf`，其它 media（如 `text/html`）原样留下。

`envelope.description` 会写到收拢后的 `200` 响应说明上。不必再手传一份 `mount` 数组，也别漏传 `app`——否则契约仍是「201 + 裸 body」、线上却是「200 + 外壳」。详见 [生成OpenAPI](/zh/openapi/)。

## 下一步

- [错误格式](/zh/web/errors)：`formatError` 与套壳的 payload
- [约束响应](/zh/web/response)：路由上声明真实状态码与内层 content
- [生成OpenAPI](/zh/openapi/)：契约如何扫路由
- [Web 应用入口](/zh/web/)：`WebApp` 其它必填项
