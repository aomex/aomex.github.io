# 接收附件

框架内置了附件的接收逻辑，并以验证器的形式导出。

```typescript{11}
import { rule } from '@aomex/core';
import { body } from '@aomex/web';
import { Router } from '@aomex/router';

const router = new Router();

router.post('/users', {
  mount: [
    body({
      name: rule.string(),
      avatar: rule.file(),
    }),
  ],
  action: async (ctx) => {
    const { avatar, name } = ctx.body;
    avatar.size; // number
    avatar.filepath; // string
    avatar.hash; // string
  },
});
```

哦？这么简单？起床起猛了？

## .mimeTypes(mimeOrExt)

限制媒体类型，比如 `.html`、`.png`, `image/*`

```typescript
rule.file().mimeTypes('image/*');
rule.file().mimeTypes('.html', 'image/*', 'text/plain');
```

## .maxSize(byte)

允许的最大体积。可选格式：

- 数字，单位（B）。比如：`1024`, `2048`
- 字符串。比如：`'15KB'`, `'20MB'`

## 多个附件

验证器默认只保留一个附件，如果上传了多个附件，则需要配合[数组验证器](/core/validator.html#rule-array-item)一起使用

```typescript
body({
  file: rule.array(rule.file());
})
```
