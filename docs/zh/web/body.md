---
outline: deep
---

# 请求实体

给 POST / PUT / PATCH 写清 JSON 或表单正文：在 mount 里挂 body()，用验证器描述字段。过关后 ctx.body 类型收窄；形状不对 **400**，包太大 **413**（在 [Web 应用入口](/zh/web/) 调 body.payload / body.formData）。

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

常见 Content-Type：application/json、application/x-www-form-urlencoded、text/\*；出现 `rule.file()` 时按 multipart/form-data 解析。

`body({ username: rule.string(), age: rule.int().optional() })` 之后，ctx.body.username 是 string，age 是 number | undefined。`body(createPostSchema.partial())` 用于 PATCH 时，各字段变为可选，但共用同一套规则。根级 `body(rule.array(...))` 或 `body(rule.oneOf([...]))` 时，ctx.body 是整个数组或联合类型。没挂 body() 时不要用 ctx.body 当初审过的输入。

别自己读 req 流做 JSON.parse——容易和框架已解析的 ctx.body 冲突，配额也不统一。

## 应用级 JSON 上限

`WebApp.body.payload.maxSize` 限制**整站** JSON / 文本体的体积；超大包在进 body() 校验前就被拒，返回 **413**。开放 API、公网 webhook 防拖垮内存时在这里设上限，路由级 schema 管不住「根本解析不完」的情况。

开放 API / webhook 防大包：

```typescript
import { logger } from '@/services/logger.service';

new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  body: { // [!code focus:3]
    payload: { maxSize: '1mb' }, // [!code highlight]
  },
  mount: [routers('./src/routers')],
});
```

## 整段数组体

有的客户端把**根级 JSON 直接建成数组**（批量 ID、事件列表），而不是 `{ items: [...] }`。在 `body()` 里传 `rule.array(...)` 或整段 schema，过关后 `ctx.body` 就是数组类型。

批量 ID、webhook 数组体：

```typescript
router.post('/batch-delete', {
  mount: [body(rule.array(rule.int()))], // [!code highlight]
  action: async (ctx) => {
    ctx.send({ deleted: ctx.body.length });
  },
});
```

## oneOf 互斥形状

同一 URL 可能收到多种「按 `type` 分支」的 JSON，但任意时刻只能匹配其中一种。`rule.oneOf([...])` 让校验器依次尝试，恰好一种过线才算合法；两种都能过或都不达标会 **400**。

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

## 创建与 PATCH

创建用完整 schema，局部更新用同一 schema 的 `.partial()`：PATCH 里各字段变为可选，规则仍和 POST 共用一套。抽到 `src/schemas/*.schema.ts` 后，路由只引用一份定义，改字段不必两处对齐。

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
import { createPostSchema } from '@/schemas/post.schema';

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
partial() 下空对象 {} 也能过校验——若必须「至少改一个字段」，在 action 里再判。客户端忘传 Content-Type 时，空 body 可能按 {} 处理，全 optional 时会静默「没改任何东西」。
:::

## 带文件

头像、附件走 `rule.file()`，细节见 [文件上传](/zh/web/attach)：

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

| 写法 | 结果 |
| --- | --- |
| `{ avatar: rule.file() }` | 单个文件，字段名 = 表单 name |
| `{ photos: rule.array(rule.file()).length({ max: 5 }) }` | 同名字段多 part，最多 5 个 |
| 嵌套对象里包 `rule.file()` | 一般对不上 multipart 的平铺字段名 |

字段级 maxSize 与应用 formData **取更严**，413 时两层配置都要查。

大段过滤条件若改成 POST + body()，文档和缓存策略要说清楚，别还按 GET 语义对外承诺。

## 下一步

- [文件上传](/zh/web/attach)
- [约束响应](/zh/web/response)
- [Web 应用入口](/zh/web/)：body 全站配额
