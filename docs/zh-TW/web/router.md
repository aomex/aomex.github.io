---
outline: deep
---

# 介面路由

在 `src/routers` 裡按領域拆檔案，每個檔案匯出一個 Router，用 get / post 註冊 action；在 WebApp 的 mount 裡用 `routers('./src/routers')` 一次性掛上。

```typescript
// src/routers/user.ts
import { Router } from '@aomex/web';

export const router = new Router();

const users = [
  { id: 1, name: 'Ada' },
  { id: 2, name: 'Bob' },
];

router.get('/users', { // [!code focus:5]
  action: async (ctx) => {
    ctx.send(users);
  },
});

router.get('/users/count', {
  action: async (ctx) => {
    ctx.send({ count: users.length });
  },
});
```

掛到應用：

```typescript
import { routers, WebApp } from '@aomex/web';

new WebApp({
  // services、logger、language、proxyIP …
  mount: [routers('./src/routers')], // [!code highlight]
});
```

測試或特性開關時，可傳具體實例，不必掃目錄：

```typescript
import { userRouter } from '@/routers/user';
import { postRouter } from '@/routers/post';

mount: [routers([userRouter, postRouter])],
```

單條路由的 mount 裡掛了 query() / body() / params() / response() 後，action 裡的 ctx 會合並對應欄位型別。**方法級** mount 隻影響當前介面；**路由級** `Router({ mount: [...] })` 對該檔案內所有方法生效。

```typescript
router.get('/users', { // [!code focus:11]
  mount: [
    middleware.web<{ tenant: string }>(async (ctx, next) => { // [!code highlight]
      ctx.tenant = ctx.request.headers['x-tenant'] as string;
      await next();
    }),
  ],
  action: (ctx) => {
    ctx.tenant;
  },
});

router.get('/users/:id', {
  action: (ctx) => {
    ctx.tenant; // 类型上不存在
  },
});
```

## prefix

`Router({ prefix })` 給本檔案裡**所有**註冊路徑加一段固定字首，避免每條 `router.get` 都手寫 `/users`。版本切換（`/v1` → `/v2`）或按域拆 URL 時只改構造引數一處即可。

```typescript
import { rule } from '@aomex/common';
import { params, Router } from '@aomex/web';

export const router = new Router({ prefix: '/users' }); // [!code highlight]

router.get('/', { // [!code focus:5]
  action: async (ctx) => {
    ctx.send([]);
  },
});

router.get('/:id', {
  mount: [params({ id: rule.int().min(1) })],
  action: async (ctx) => {
    ctx.send({ id: ctx.params.id });
  },
});
```

最終路徑 = prefix + 註冊時的 uri（多餘斜槓會歸一）。聯調 404 時別隻看 `router.get('/:id')`，要先拼上 prefix 全路徑。

OpenAPI 按域分組用 `Router({ docs: { tags: ['User'] } })`；單路由 `docs.summary` 可覆蓋。

## 路由級 mount

路由級 `Router({ mount: [...] })` 把中介軟體掛在整個檔案的所有方法上：整組都要登入、記審計、或統一掛 query 預設值時用這個入口，比在每個 `router.get` 裡重複 mount 省事。

整檔案都要登入、審計時：

```typescript
new Router({
  prefix: '/admin',
  mount: [auth.authenticate('bearer')],
});
```

路由級 mount 對該檔案內**所有**方法生效；公開介面和要登入的介面別擠在同一 Router 裡——公開頁拆檔案，或改方法級 mount / skip。

## 單條路由 mount、docs、disabled

**方法級 mount** 只作用於這一條路由：入參校驗（query / body / params / response）、單介面鑑權等。和路由級 mount 疊在一起時，先走路由級，再進方法級。

**disabled** 讓某條路由在執行時**不註冊**（匹配不到、不會進 action）。常用環境變數或特性開關關掉半成品介面，比在生產裡留 501 更安全。

**docs** 寫這條路由在 OpenAPI 裡的說明（如 `summary`）。`Router({ docs: { tags } })` 負責分組；單路由 docs 可覆蓋標題和描述，生成文件時和 [response()](/zh-TW/web/response) 一起被掃進契約。

```typescript
import { rule } from '@aomex/common';
import { query, response, Router } from '@aomex/web';

router.get('/users', { // [!code focus:11]
  disabled: process.env['FEATURE_USERS'] !== '1', // [!code highlight]
  mount: [
    query({ page: rule.int().min(1).default(1) }),
    response({ statusCode: 200, content: rule.array({ id: rule.int() }) }),
  ],
  docs: { summary: '用户列表' }, // [!code highlight]
  action: async (ctx) => {
    ctx.send([]);
  },
});
```

OpenAPI 後設資料詳見 [生成OpenAPI](/zh-TW/openapi/) · [Tags 分組](/zh-TW/openapi/tags)。

單條路徑引數：

```typescript
router.get('/users/:id', {
  mount: [params({ id: rule.int().min(1) })], // [!code highlight]
  action: async (ctx) => {
    ctx.send({ id: ctx.params.id });
  },
});
```

路徑引數不掛 params() 時，`ctx.request.params` 全是字串，"1" 和 1 在業務裡容易混。

## HTTP 方法

每個 `router.<method>(uri, { ... })` 繫結一種 HTTP 動詞；登記順序不影響匹配，靜態段和字面量路徑仍優先於 `:param`。

| 方法 | 說明 |
| --- | --- |
| `get` | `GET`；**HEAD** 與同名 `GET` 共享匹配 |
| `post` / `put` / `patch` / `delete` | 對應動詞 |
| `all` | 上述全部動詞 |
| `customize` | 自選動詞陣列 |

`customize` 在同一路徑上同時接受多種動詞（GET 校驗、POST 回執等），標準 `get` / `post` 各註冊一遍會佔兩條路由、也不好維護。第三方 webhook、健康檢查兼探測時常用它：

第三方 webhook 用 customize：

```typescript
router.customize(['GET', 'POST'], '/webhook', { // [!code highlight]
  action: async (ctx) => {
    ctx.send({ ok: true });
  },
});
```

## 路徑寫法

註冊 uri 時，**字面量段**優先於 `:param`，所以 `/users/count` 不會被 `/:id` 吃掉。命名引數鍵名要和 `params()` 裡的欄位一致。

| 寫法 | 含義 |
| --- | --- |
| `/users/:id` | 命名引數 `id` |
| `/users/count` 與 `/users/:id` 並存 | 字面量路徑優先，`:id` 不會吃掉 `count`；別指望註冊順序救場，能寫靜態段就寫靜態段 |

glob 掃目錄時儘量只放 Router 匯出，雜檔案多了難排查「為什麼沒註冊上」。

## 下一步

- [Web 應用入口](/zh-TW/web/)：WebApp 與全站 mount
- [查詢字串](/zh-TW/web/query)：GET 篩選與分頁
- [路徑引數](/zh-TW/web/params)、[請求實體](/zh-TW/web/body)
