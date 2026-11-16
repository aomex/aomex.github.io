---
outline: deep
---

# 請求實體

給 POST / PUT / PATCH 寫清 JSON 或表單正文：在 mount 裡掛 body()，用驗證器描述欄位。過關後 ctx.body 型別收窄；形狀不對 **400**，包太大 **413**（在 [Web 應用入口](/zh-TW/web/) 調 body.payload / body.formData）。

```typescript
import { rule } from '@aomex/common';
import { body, Router } from '@aomex/web';

export const router = new Router();

router.post('/users', { // [!code focus:13]
  mount: [
    body({ // [!code highlight]
      username: rule.string().length({ min: 2, max: 32 }),
      age: rule.int().min(0).max(150).optional(),
    }),
  ],
  action: async (ctx) => {
    const { username, age } = ctx.body;
    ctx.send(201, { username, age });
  },
});
```

常見 Content-Type：application/json、application/x-www-form-urlencoded、text/\*；出現 `rule.file()` 時按 multipart/form-data 解析。

`body({ username: rule.string(), age: rule.int().optional() })` 之後，ctx.body.username 是 string，age 是 number | undefined。`body(createPostSchema.partial())` 用於 PATCH 時，各欄位變為可選，但共用同一套規則。根級 `body(rule.array(...))` 或 `body(rule.oneOf([...]))` 時，ctx.body 是整個陣列或聯合型別。沒掛 body() 時不要用 ctx.body 當初審過的輸入。

別自己讀 req 流做 JSON.parse——容易和框架已解析的 ctx.body 衝突，配額也不統一。

## 應用級 JSON 上限

`WebApp.body.payload.maxSize` 限制**整站** JSON / 文本體的體積；超大包在進 body() 校驗前就被拒，返回 **413**。開放 API、公網 webhook 防拖垮記憶體時在這裡設上限，路由級 schema 管不住「根本解析不完」的情況。

開放 API / webhook 防大包：

```typescript
new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  body: { // [!code focus:3]
    payload: { maxSize: '1mb' }, // [!code highlight]
  },
  mount: [routers('./src/routers')],
});
```

## 整段陣列體

有的客戶端把**根級 JSON 直接建成陣列**（批次 ID、事件列表），而不是 `{ items: [...] }`。在 `body()` 裡傳 `rule.array(...)` 或整段 schema，過關後 `ctx.body` 就是陣列型別。

批次 ID、webhook 陣列體：

```typescript
router.post('/batch-delete', {
  mount: [body(rule.array(rule.int()))], // [!code highlight]
  action: async (ctx) => {
    ctx.send({ deleted: ctx.body.length });
  },
});
```

## oneOf 互斥形狀

同一 URL 可能收到多種「按 `type` 分支」的 JSON，但任意時刻只能匹配其中一種。`rule.oneOf([...])` 讓校驗器依次嘗試，恰好一種過線才算合法；兩種都能過或都不達標會 **400**。

```typescript
router.post('/events', { // [!code focus:13]
  mount: [
    body( // [!code highlight]
      rule.oneOf([
        rule.object({ type: rule.literal('a'), a: rule.int() }),
        rule.object({ type: rule.literal('b'), b: rule.string() }),
      ]),
    ),
  ],
  action: async (ctx) => {
    ctx.send({ ok: true });
  },
});
```

## 建立與 PATCH

建立用完整 schema，區域性更新用同一 schema 的 `.partial()`：PATCH 裡各欄位變為可選，規則仍和 POST 共用一套。抽到 `src/schemas/*.schema.ts` 後，路由只引用一份定義，改欄位不必兩處對齊。

```typescript
// src/schemas/post.schema.ts
import { schema, rule } from '@aomex/common';

export const createPostSchema = schema({
  title: rule.string(),
  content: rule.string(),
});
```

```typescript
import { body } from '@aomex/web';
import { createPostSchema } from '../schemas/post.schema.js';

router.post('/posts', { // [!code focus:6]
  mount: [body(createPostSchema)], // [!code highlight]
  action: async (ctx) => {
    ctx.send(201, await createPost(ctx.body));
  },
});

router.patch('/posts/:id', {
  mount: [body(createPostSchema.partial())], // [!code highlight]
  action: async (ctx) => {
    ctx.send(await patchPost(ctx.params.id, ctx.body));
  },
});
```

::: warning
partial() 下空物件 {} 也能過校驗——若必須「至少改一個欄位」，在 action 裡再判。客戶端忘傳 Content-Type 時，空 body 可能按 {} 處理，全 optional 時會靜默「沒改任何東西」。
:::

## 帶檔案

頭像、附件走 `rule.file()`，細節見 [檔案上傳](/zh-TW/web/attach)：

```typescript
router.post('/avatar', { // [!code focus:12]
  mount: [
    body({
      name: rule.string(),
      avatar: rule.file().maxSize('2mb').mimeTypes('image/*'), // [!code highlight]
    }),
  ],
  action: async (ctx) => {
    const { avatar } = ctx.body;
    await saveAvatar(avatar);
    ctx.send({ ok: true });
  },
});
```

| 寫法 | 結果 |
| --- | --- |
| `{ avatar: rule.file() }` | 單個檔案，欄位名 = 表單 name |
| `{ photos: rule.array(rule.file()).length({ max: 5 }) }` | 同名欄位多 part，最多 5 個 |
| 巢狀物件裡包 `rule.file()` | 一般對不上 multipart 的平鋪欄位名 |

欄位級 maxSize 與應用 formData **取更嚴**，413 時兩層配置都要查。

大段過濾條件若改成 POST + body()，文件和快取策略要說清楚，別還按 GET 語義對外承諾。

## 下一步

- [檔案上傳](/zh-TW/web/attach)
- [約束響應](/zh-TW/web/response)
- [Web 應用入口](/zh-TW/web/)：body 全站配額
