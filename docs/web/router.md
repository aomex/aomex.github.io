# 路由

不同的请求路径，代表着不同业务逻辑。我们不会傻到让你在中间件里手动判断`pathname`来确定要响应的内容，我们采用路径映射的方式，即`路由`模块

```typescript
// ./src/routers/user.ts
import { Router, params } from '@aomex/router';

export const router = new Router({ prefix: '/users' });

const users = [
  { id: 1, name: 'user1' },
  { id: 2, name: 'user2' },
];

// 映射路径：GET /users
router.get('/', {
  async action(ctx) {
    ctx.send(users);
  },
});

// 映射路径：GET /users/1
router.get('/:id', {
  mount: [params({ id: rule.int() })],
  async action(ctx) {
    const user = users.find((item) => item.id === ctx.params.id);
    if (user) {
      ctx.send(200, user);
    } else {
      ctx.throw(404);
    }
  },
});
```

写了两个接口，获取所有用户和获取单个用户，怎么挂载到入口呢？这个问题太简单了，等着：

```typescript{4,5}
// ./src/index.ts
import { routers } from '@aomex/router';

const app = new WebApp();
// 挂载目录和子目录下所有的路由文件
app.mount(routers('./src/routers'));

app.listen(3000);
```

打开浏览器访问 [http://localhost:3000/users](http://localhost:3000/users) 和 [http://localhost:3000/users/1](http://localhost:3000/users/1) 看看效果

是不是很简单？aomex框架会自动去找，而不需要像koa一样还要引入所有路由文件，然后挨个挂载到app上。我们不愿意看到你重复地做这些（或其它）琐事，你要做的就是在路由文件里使用`export const router =`，然后专心写出优质逻辑

> 使用官方插件就能轻松地把接口转换成openapi/swagger文档，这是前端开发者的福音
