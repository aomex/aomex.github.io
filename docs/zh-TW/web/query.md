---
outline: deep
---

# 查詢字串

給 GET（或帶 query 的其它動詞）介面宣告 ?page=1&keyword= 這類引數：在路由 mount 裡掛 query()，用 [驗證器](/zh-TW/validators/) 約束型別和範圍。過關後業務裡直接用 ctx.query；不過關自動 **400**，不進 action。

```typescript
import { rule } from '@aomex/common';
import { query, Router } from '@aomex/web';

export const router = new Router();

router.get('/users', { // [!code focus:13]
  mount: [
    query({ // [!code highlight]
      page: rule.int().min(1).default(1),
      size: rule.int().min(5).max(50).default(10),
      keyword: rule.string().optional(),
    }),
  ],
  action: async (ctx) => {
    const { page, size, keyword } = ctx.query;
    ctx.send({ page, size, keyword, items: [] });
  },
});
```

請求示例：GET /users?page=2&size=20&keyword=ada。

掛了 query() 後，ctx.query 只含宣告過的鍵；default() 讓預設引數在型別上是必填的數值/字串（例如 page 始終是 number）。optional() 的欄位型別帶 undefined。沒在 mount 裡掛 query() 時，只有 `ctx.request.query` 之類較寬的型別——業務裡別直接當可信資料用。校驗失敗不進 action，響應 **400**。

別在 action 裡手寫 `Number(ctx.request.query.page)`——和 OpenAPI、校驗錯誤格式脫節，型別也不會自動收窄。

## 複用列表 schema

多個列表介面共用 `page` / `size` / `q` 時，把 query 欄位收到 `src/schemas/*.schema.ts`，路由裡 `query(listQuerySchema)` 引用同一份。改分頁上限或預設值只動一處，OpenAPI 也會跟著同一套描述走。

多個列表介面共用分頁 / q 搜尋時，抽到 `src/schemas/*.schema.ts`：

```typescript
// src/schemas/list-query.schema.ts
import { schema, rule } from '@aomex/common';

export const listQuerySchema = schema({
  page: rule.int().min(1).default(1),
  size: rule.int().max(100).default(20),
  q: rule.string().trim().optional(),
});
```

```typescript
// src/routers/user.ts
import { query, Router } from '@aomex/web';
import { listQuerySchema } from '@/schemas/list-query.schema';

const router = new Router();

router.get('/users', { // [!code focus:6]
  mount: [query(listQuerySchema)], // [!code highlight]
  action: async (ctx) => {
    const { page, size, q } = ctx.query;
    ctx.send(await searchUsers({ page, size, q }));
  },
});
```

列舉排序欄位：

```typescript
sort: rule.enum(['name', 'createdAt'] as const).default('createdAt'),
```

OpenAPI 說明掛在 rule 或路由上：

```typescript
page: rule.int().min(1).docs({ description: '页码，从 1 起' }),
```

## 與 body / params 分工

三種入參來源別混用職責：**query** 做篩選和分頁（冪等 GET），**params** 標識路徑裡的資源，**body** 承載建立/更新的實體。搞錯位置會導致快取、日誌和 OpenAPI 都跟真實語義不一致。

| 來源 | 典型用途 |
| --- | --- |
| **query** | 過濾、分頁、排序——冪等 GET |
| **params** | 路徑裡的資源 ID |
| **body** | POST / PUT / PATCH 的實體 |

大段 JSON 過濾若硬塞 query，URL 會爆、快取鍵難管——這類可改 POST + `body()`，接受不能當冪等 GET 快取的代價。POST 建立卻用 query 傳大 JSON 同樣違背慣例。

::: tip
列表頁客戶端常多傳跟蹤引數；query 別開得過於 strict 或多餘必填，否則 B2B 對接很容易 400。default() 讓型別上有預設值，但訪問日誌裡的原始 URL 未必帶 ?page=1。
:::

## 下一步

- [路徑引數](/zh-TW/web/params)
- [請求實體](/zh-TW/web/body)
- [驗證器鏈式方法](/zh-TW/validators/chain)：default、optional、transform
