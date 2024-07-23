# 路径参数

框架提供了获取路径参数的中间件，并使用验证器过滤输入。

```typescript
import { params, Router } from '@aomex/web';

export const router = new Router();

router.get('/users/:id', {
  mount: [
    params({
      id: rule.int().min(1),
    }),
  ],
  action: async (ctx) => {
    const { id } = ctx.params;
    const user = await service.getUser(id);

    if (!user) ctx.throw(404);
    ctx.send(user);
  },
});
```

输入被成功验证后，action函数会被立即调用，并且`ctx.params`只包含被验证过后的属性。反之，本次请求自动响应 `400状态码`错误。
