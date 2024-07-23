# 请求实体

框架提供了获取实体的中间件，并使用验证器过滤输入。支持表单、JSON、XML

```typescript
import { body, Router } from '@aomex/web';

export const router = new Router();

router.post('/users', {
  mount: [
    body({
      username: rule.string().docs({ description: '昵称' }),
      age: rule.int().min(1).optional(),
    }),
  ],
  action: async (ctx) => {
    const user = await service.createUser(ctx.body);
    ctx.send(201, user);
  },
});
```

输入被成功验证后，action函数会被立即调用，并且`ctx.body`只包含被验证过后的属性。反之，本次请求自动响应 `400状态码`错误。
