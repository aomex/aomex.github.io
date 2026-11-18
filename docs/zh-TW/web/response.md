---
outline: deep
---

# 約束響應

給一條路由宣告「可能返回哪些狀態碼、成功體長什麼樣」：在 mount 裡掛 response()。不改變世界怎麼發資料，但會收窄 ctx.send / ctx.throw / ctx.redirect 的型別，並寫進 OpenAPI。聲明瞭 200 卻 send(201)，編譯器會紅——這是刻意的。

```typescript
import { rule } from '@aomex/common';
import { response, Router } from '@aomex/web';

export const router = new Router();

router.get('/me', { // [!code focus:19]
  mount: [
    response({ // [!code highlight]
      statusCode: 200,
      content: {
        id: rule.int(),
        name: rule.string(),
      },
    }),
    response({ statusCode: 404 }),
  ],
  action: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) {
      return ctx.throw(404, 'not found');
    }
    ctx.send({ id: user.id, name: user.name });
  },
});
```

缺資源用 throw(404)，成功用 send——別混成 send(404)。response() 約束的是編譯期和文件，**不會**在執行時再驗一遍 send 的 body。

掛了 200 的 content 後，ctx.send({ id, name }) 必須與驗證器推斷一致。聲明瞭 `response({ statusCode: 404 })` 後，ctx.throw(404, …) 才「合法出口」。**201**、其它非 200 的 2xx 要在 send 裡**顯式寫狀態碼**；**204** 用 ctx.send(204)，不要再塞 {}。**3xx** 走 ctx.redirect(status, url)。可以多次掛 response()，分別寫成功態和錯誤態。

| 狀態碼 | 常見做法是怎麼發 |
| --- | --- |
| `200` | `send(body)` 或 `send(200, body)` |
| 其它 2xx | `send(status, body)` |
| 204 等無 body | `send(status)` |
| 3xx | `redirect(status, url)` |
| 4xx / 5xx | `throw(status, …)` |

## 建立資源 201

REST 裡「新建成功」常用 **201**，body 裡帶新資源的 id 等欄位。在 mount 裡宣告 `response({ statusCode: 201, content: ... })`，action 裡用 `ctx.send(201, body)`，型別和 OpenAPI 才會把 201 當成合法出口。

```typescript
import { body } from '@aomex/web';

router.post('/users', { // [!code focus:15]
  mount: [
    body({
      name: rule.string().trim().length({ min: 1 }),
    }),
    response({ // [!code highlight]
      statusCode: 201,
      content: { id: rule.int(), name: rule.string() },
    }),
    response({ statusCode: 400 }),
  ],
  action: async (ctx) => {
    const user = await createUser(ctx.body);
    ctx.send(201, { id: user.id, name: user.name });
  },
});
```

## 刪除成功 204

刪除成功且**不需要返回 JSON** 時用 **204 No Content**。宣告 `response({ statusCode: 204 })` 後，`ctx.send(204)` 才是收窄後的正確寫法；別在 204 裡再塞 `{}`。

```typescript
import { params } from '@aomex/web';

router.delete('/users/:id', {
  mount: [
    params({ id: rule.int().min(1) }),
    response({ statusCode: 204 }), // [!code highlight]
    response({ statusCode: 404 }),
  ],
  action: async (ctx) => {
    const ok = await deleteUser(ctx.params.id);
    if (!ok) {
      return ctx.throw(404);
    }
    ctx.send(204);
  },
});
```

## 重定向 3xx

短鏈、登入後跳轉、舊 URL 遷到新域名時走 **3xx**，業務裡用 `ctx.redirect(status, url)` 而不是手寫 Location。在 mount 裡掛上對應 `response({ statusCode: 302 })`（或其它 3xx），型別裡才會把 redirect 算進合法出口。

```typescript
router.get('/go', {
  mount: [
    response({ statusCode: 302 }), // [!code highlight]
  ],
  action: async (ctx) => {
    ctx.redirect(302, 'https://example.com');
  },
});
```

## 分頁列表信封

列表介面常在 200 裡返回 `{ total, items }` 這類固定信封，而不是裸陣列。用 `response({ statusCode: 200, content: { total, items: rule.array(...) } })` 和 [query()](/zh-TW/web/query) 對齊分頁入參，前端和 OpenAPI 都能看到同一形狀。

```typescript
import { query } from '@aomex/web';

router.get('/users', { // [!code focus:22]
  mount: [
    query({
      page: rule.int().min(1).default(1),
      size: rule.int().min(1).max(50).default(20),
    }),
    response({ // [!code highlight]
      statusCode: 200,
      content: {
        total: rule.int(),
        items: rule.array({
          id: rule.int(),
          name: rule.string(),
        }),
      },
    }),
  ],
  action: async (ctx) => {
    const { page, size } = ctx.query;
    const { total, items } = await listUsers({ page, size });
    ctx.send({ total, items });
  },
});
```

只掛校驗類 400、不寫欄位形狀時，正文常跟全域性 formatError 對齊：

```typescript
response({ statusCode: 400 }),
```

SSE、純文本等特殊媒體型別：

```typescript
response({
  statusCode: 200,
  contentType: 'text/event-stream', // [!code highlight]
  content: rule.string(),
}),
```

## 跳過響應套殼

全站配了 [envelope](/zh-TW/web/envelope) 時，某個狀態碼仍要**裸寫出**，在對應 `response()` 上加 `skipEnvelope: true`。只影響本條的 `statusCode`；同路由其它狀態碼照常套殼。執行時與 OpenAPI 一起登記。

```typescript
router.get('/report.pdf', { // [!code focus:12]
  mount: [
    response({
      statusCode: 200,
      contentType: 'application/pdf',
      content: rule.string(),
      skipEnvelope: true, // [!code highlight]
    }),
    response({ statusCode: 404 }),
  ],
  action: async (ctx) => {
    ctx.send(await loadPdf());
  },
});
```

文件頁、裸 OpenAPI JSON 這類基礎設施出口，也可在 action 裡設 `ctx.response.skipEnvelope = true`（無條件跳過本次）。業務路由優先用上面的選項，避免文件漏記。

不掛 response() 也能 ctx.send；上線前補上成功態和常見的 400/404，避免 OpenAPI 和型別裡響應是空洞。宣告 200 卻在 action 裡 `send(201)` 會直接型別報錯——改狀態碼或改 response() 宣告。

## 下一步

- [錯誤格式](/zh-TW/web/errors)（4xx/5xx JSON 與 response 配合）
- [響應體套殼](/zh-TW/web/envelope)（外層固定 200、body 統一外殼；`skipEnvelope`）
- [請求實體](/zh-TW/web/body) / [查詢引數](/zh-TW/web/query)（入參側對稱寫法）
- [OpenAPI 文件生成](/zh-TW/openapi/)