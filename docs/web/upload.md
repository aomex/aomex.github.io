# 上传文件

这么重要又**难受**的场景，框架肯定是已经考虑好了。话不多说，上代码：

```typescript
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
  action(ctx) {
    const { avatar, name } = ctx.body;
    avatar.size; // number
    avatar.filepath; // string
    avatar.newFilename; // string
    avatar.hash; // string
  },
});
```

通过web应用定制的`rule.file()`验证器，我们可以轻松愉快地获得文件句柄。后续转移目录或者上传到云存储空间，那还不是手到擒来？

当然文件验证器也允许做一些定制化的操作：

| 扩展                             | 说明                                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `.maxSize(type:number\|string)`  | 允许的最大体积。可以传递数字<small>（单位byte）</small>或者字符串。比如： `1024`、 `15MB`                                    |
| `.mimeTypes(mineOrExt:string[])` | 允许的媒体类型。比如`.html`、`.png`, `image/*`                                                                               |
| `.optional()`                    | 允许数据是 `undefined, null, ''`或者**不传**，统一转换成**undefined**                                                        |
| `.docs({ ... })`                 | 扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为`replace` |
| `.transform(fn)`                 | 数据验证成功后触发，允许我们对数据进行最后的转换操作                                                                         |
