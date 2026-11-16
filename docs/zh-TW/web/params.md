---
outline: deep
---

# 路徑引數

路由寫成 /users/:id 這類别範本後，匹配到的段會先以**字串**躺在 `ctx.request.params` 裡。用 mount 裡的 params() 做型別和範圍校驗，業務裡用乾淨的 ctx.params；形態不合法 **400**，查無此人再 **404**。

```typescript
import { rule } from '@aomex/common';
import { params, Router } from '@aomex/web';

export const router = new Router();

router.get('/users/:id', { // [!code focus:15]
  mount: [
    params({ // [!code highlight]
      id: rule.int().min(1),
    }),
  ],
  action: async (ctx) => {
    const { id } = ctx.params;
    const user = await findUser(id);
    if (!user) {
      ctx.throw(404, 'user not found');
    }
    ctx.send(user);
  },
});
```

:id 能匹配任意字串不代表合法 ID——範圍、UUID 交給驗證器；形態錯用 **400**，查無此人再用 **404**，否則監控會把筆誤當成資源缺失。

`params({ id: rule.int().min(1) })` 之後，ctx.params.id 是 number。路由模板 :userId 與 schema 鍵 userId 必須一致。沒掛 params() 時只有字串——"42" 和 42 在業務判斷裡容易混。路徑根本沒匹配到路由時，不會執行 params()，那是 404 的事，不是校驗 400。

路由寫 :userId 卻 `params({ id: ... })` 會對不上鍵名；也別用 query 重複傳一份 id 並以 query 為準——路徑和 query 不一致時快取、許可權、日誌都會亂。

## UUID 與多段路徑

對外 ID 是 UUID 時用 `rule.uuid()`，避免把任意字串當成合法主鍵。路徑裡有多段佔位（`/users/:userId/posts/:postId`）時，在**同一個** `params({ ... })` 裡宣告所有鍵，鍵名必須和路由模板一致。

對外暴露 UUID 的資源：

```typescript
params({ id: rule.uuid() }),
```

```typescript
router.get('/users/:userId/posts/:postId', { // [!code focus:12]
  mount: [
    params({ // [!code highlight]
      userId: rule.int().min(1),
      postId: rule.int().min(1),
    }),
  ],
  action: async (ctx) => {
    const { userId, postId } = ctx.params;
    ctx.send({ userId, postId });
  },
});
```

## 複用 param schema

`:id` 在多個路由裡重複出現時，把 `params` 形狀抽到 schema 檔案，和 [body / query 複用](/zh-TW/web/body) 同一套路。改 ID 規則（int → uuid）時只改 schema 一處。

```typescript
// src/schemas/user-id-param.schema.ts
import { schema, rule } from '@aomex/common';

export const userIdParamSchema = schema({
  id: rule.uuid(),
});
```

```typescript
import { params } from '@aomex/web';
import { userIdParamSchema } from '../schemas/user-id-param.schema.js';

router.get('/users/:id', { // [!code focus:5]
  mount: [params(userIdParamSchema)], // [!code highlight]
  action: async (ctx) => {
    ctx.send(await findUser(ctx.params.id));
  },
});
```

掛 params() 後 OpenAPI 裡 path 引數自動 in: path 且 required。

## 下一步

- [查詢字串](/zh-TW/web/query)
- [請求實體](/zh-TW/web/body)
- [介面路由](/zh-TW/web/router)：靜態路徑與 :id 並存