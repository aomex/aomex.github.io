# 查询字符串

查询字符串就是超链接问号后面的字符串，比如 **http://example.com?page=1&pageSize=10** 中，`page=1&pageSize=10`就是查询字符串

框架提供了获取查询字符串的中间件，并使用验证器过滤输入

```typescript
import { query, Router } from '@aomex/web';

export const router = new Router();

router.get('/users', {
  mount: [
    query({
      page: rule.int().min(1).default(1),
      size: rule.int().min(5).max(50).default(10),
    }),
  ],
  action: async (ctx) => {
    const { page, size } = ctx.query; // 类型安全
    const { result, total } = await service.getUsers(page, size);

    ctx.send(200, { page, size, result, total });
  },
});
```

输入被成功验证后，action函数会被立即调用，并且`ctx.query`只包含被验证过后的属性。反之，本次请求自动响应 `400状态码`错误。
