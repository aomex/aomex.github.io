---
outline: deep
---

# 文件上传

做一个带头像或附件的 multipart 接口：在 body() 里把文件字段标成 [rule.file()](/zh/validators/rules/file)，过关后从 ctx.body 拿临时路径和 MD5，在本轮请求结束前搬走（OSS、本地存储都行）。没挂 body() 的 multipart 不会帮你解析文件。

```typescript
import { rule } from '@aomex/common';
import { body, Router } from '@aomex/web';

export const router = new Router();

router.post('/users', { // [!code focus:13]
  mount: [
    body({ // [!code highlight]
      name: rule.string(),
      avatar: rule.file(),
    }),
  ],
  action: async (ctx) => {
    const { name, avatar } = ctx.body;
    await saveAvatarToOss(avatar.filepath, avatar.hash);
    ctx.send(201, { name, hash: avatar.hash });
  },
});
```

客户端用 multipart/form-data：name 普通字段，avatar 是文件 part。常见做法是会在 action 里立刻上传或复制，再返回——响应结束后临时文件会被清掉。

avatar 校验通过后大致有 filepath、size、mimetype、hash、hashAlgorithm、originalFilename；业务里最常用 filepath 和 hash。`rule.array(rule.file())` 时 ctx.body.attachments 是文件对象数组。

::: warning
返回 201 之前还没把文件搬走或上传完，临时路径不保证下一轮还能读。
:::

## 体积与 MIME

单字段 `rule.file().maxSize()` / `.mimeTypes()` 在**校验阶段**拦住超大或类型不对的上传，比进 action 再判省一轮 IO。和应用级 `formData` 叠用时取更严的一侧；只改路由要记得两边一起看 413。

```typescript
body({
  avatar: rule.file().maxSize('2mb'),
});
```

```typescript
body({
  avatar: rule.file().mimeTypes('.png', 'image/*'),
});
```

`rule.file().maxSize('2mb')` 只收窄该字段；和应用级 formData.maxFileSize 叠在一起时，**谁更严听谁的**。

魔数不稳时退回 MIME：

```typescript
rule.file().mimeTypes('image/svg+xml').fallbackToMimetype(),
```

::: warning
公网头像别轻易 fallbackToMimetype()——更信客户端报的 Content-Type，只适合内网等可控场景。
:::

## 多文件同一字段

HTML 表单里同名 input 可传多个 part，`rule.array(rule.file())` 把它们收成数组。用 `.length({ max: n })` 限制单次请求个数，避免一次塞进过多大文件。

```typescript
body({
  attachments: rule.array(rule.file().maxSize('10mb')).length({ max: 5 }),
});
```

同一请求里多个文件字段时，总个数还会受应用级 formData.maxFiles 约束，和路由级配额一起取更严。

## 与 WebApp.formData 配额

文件解析分两层：**WebApp.body.formData** 设全站默认（单文件体积、总 part 数），路由里 `rule.file()` 再收窄某个字段。只改一层出现 413 时，要查是应用顶住了还是字段规则顶住了。

| 层 | 常见做法是怎么用 |
| --- | --- |
| `WebApp.body.formData` | 全站默认上限，大文件站点先调这里 |
| `body()` + schema | 只解析 schema 里点名的字段 |
| `rule.file()` | 单字段业务规则（MIME、体积） |

```typescript
import { logger } from '@/services/logger.service';

new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  body: { // [!code focus:3]
    formData: { maxFileSize: '20mb', maxFiles: 10 }, // [!code highlight]
  },
  mount: [routers('./src/routers')],
});
```

大文件走磁盘临时目录而不是整坨进内存，方便你流式上传到对象存储。路由里只改 maxSize 时记得对照应用级 formData，413 要两层都查。

嵌套对象里塞 `rule.file()` 常对不上 multipart 的平铺字段名，复杂结构要先对齐客户端怎么传。

::: warning
mimeTypes 里无法识别的 token 会在配置阶段就报错，省得 silently 放开全部类型。
:::

## 下一步

- [请求实体](/zh/web/body)（multipart 白名单、创建与 PATCH）
- [rule.file()](/zh/validators/rules/file)（字段级专属选项）
- [Web 应用入口](/zh/web/)（body.formData 全局配额）