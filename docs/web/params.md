# 路径参数

路径参数就是与路径混合使用的动态参数，比如 **http://example.com/users/2/post/363** 中，2和363就是参数，可以根据业务动态调整以获取相应的资源。

路由本身可以获取路径参数，但是无法校验参数的正确性，因此框架提供了增强路径参数的中间件，并使用验证器过滤输入。

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
