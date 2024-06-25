# 接口路由

在真实项目中，每个功能可能都有 增、删、改、查 的接口，如果全部放在应用入口，则难以管理。因此我们引入了路由，根据功能对接口进行模块化分类

## 安装

```bash
pnpm add @aomex/router
```

## 第一个路由

```typescript
// ./src/routers/user.ts
import { Router, params } from '@aomex/router';

const users = [
  { id: 1, name: 'user1' },
  { id: 2, name: 'user2' },
];

export const router = new Router();

router.get('/users', {
  action: async (ctx) => {
    ctx.send(users);
  },
});

router.get('/users/count', {
  action: async (ctx) => {
    ctx.send(users.length);
  },
});
```

就在刚刚，我们写了两个接口

- GET /users
- GET /users/count

## 注册

在访问接口之前，别忘了一件很重要的事情，就是挂载路由。框架采用了自动寻找路由的方式注册接口，我们再也不用重复地导出到入口文件（枯燥且浪费生命），真正做到了一劳永逸！

```typescript{6}
// ./src/web.ts
import { WebApp,mdchain } from '@aomex/core';
import { routers } from '@aomex/router';

const app = new WebApp({
  mount: mdchain.web.mount(routers('./src/routers'))
});

app.listen(3000);
```

现在，打开浏览器访问 [http://localhost:3000/users](http://localhost:3000/users) 看看效果

## 前缀

我们开始把相同的功能放在同一个路由文件里，管理方便，阅读顺畅。因此，大概率会出现相同的路由前缀，

- GET /users
- GET /users/:id
- GET /users/:id/posts
- POST /users
- PUT /users/:id
- DELETE /users/:id

现在，我们尝试把相同的前缀抽取出来

```typescript{2}
export const router = new Router({
  prefix: '/users',
});

router.get('/', { action: () => {} });
router.get('/:id', { action: () => {} });
router.post('/', { action: () => {} });
```

文件开始变得清爽，这也进一步减少了写错单词的概率（比如如果混进去一个 /usre 路由）

## 方法级中间件

路由的每个接口都能挂载自己的中间件，互不影响

```typescript{7-11}
import { middleware } from '@aomex/core';
import { Router } from '@aomex/router';

export const router = new Router();

router.get('/users', {
  mount: [
    middleware.web<{ foo: string }>((ctx, next) => {
      ctx.foo = 'bar';
      return next();
    }),
  ],
  action: (ctx) => {
    ctx.foo; // 'bar'
  },
});

router.get('/users/:id', {
  action: (ctx) => {
    ctx.foo;
          ⤷ Property 'foo' does not exist on type 'object'. // [!code error]
  },
});
```

## 路由级中间件

如果所有的接口都需要使用某个中间件，则建议提取到路由级别。

```typescript{5-9}
import { mdchain } from '@aomex/core';
import { Router } from '@aomex/router';

export const router = new Router({
  mount: mdchain.web.mount(
    middleware.web<{ foo: string }>((ctx, next) => {
      ctx.foo = 'bar';
      return next();
    }),
  ),
});

router.get('/users', {
  action: (ctx) => {
    ctx.foo; // 'bar'
  },
});

router.get('/users/:id', {
  action: (ctx) => {
    ctx.foo; // 'bar'
  },
});
```
