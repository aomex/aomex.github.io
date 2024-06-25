# 中间件链条

一般情况下，我们会把一些全局性质的中间件挂载到**应用入口**而不是路由，比如 `cors` 和 `compress` 这两个中间件，基本上每次请求都需要使用。因此我们可能会这么做：

```typescript{2}
const app = new WebApp({
  mount: middleware.web.mount(cors).mount(compress),
});

app.listen();
```

而`compress`中间件其实是带有一个可配置属性的`{ needCompress?: boolean }`，在路由层使用可能就会出现类型不安全的问题

```typescript
export const router = new Router();

router.get('/', {
  action: (ctx) => {
    // 手动触发压缩
    ctx.needCompress = true;
             ⤷ Property 'needCompress' does not exist on type 'object'. // [!code error]
    ctx.send('small');
  }
});
```

不在全局声明的话，想让全局中间件精准提示是个很棘手的问题（确实困扰作者很久）。在此环境下，链条概念孕育而生：

::: code-group

```typescript [middleware/web.chain.ts]
import { mdchain } from '@aomex/core';

// 假设有如下这些中间件
const a!: WebMiddleware<{ needCompress?: boolean }>;
const b!: WebMiddleware<{ data2: string }>;
const c!: WebMiddleware<{ data3: number }>;
const d!: WebMiddleware<{ data3: number }>;
const e!: WebMiddleware<{ data3: number }>;

// 组成链条
export const appChain = mdchain.web.mount(a).mount(b);
export const routerChain = appChain.mount(c).mount(d).mount(e);
```

```typescript{4} [web.ts]
import { appChain } from './middleware/web.chain';

const app = new WebApp({
  mount: appChain,
});

app.listen();
```

```typescript{4} [routers/api.router.ts]
import { routerChain } from '../middleware/web.chain';

export const router = new Router({
  mount: routerChain,
});

router.get('/', {
  action: (ctx) => {
    ctx.needCompress = true;
    ctx.send('small');
  }
});
```

:::

完美提示！！
注意看，在创建链条时，我们创建了两个变量`appChain`和`routerChain`，接着appChain被挂载到了应用入口，而routerChain被挂载到了路由。现在我们看看这里包含的5个中间件分别是怎么分配的：

- 全局 -> a,b
- 路由 -> c,d,e

怎么做到的？

其实`appChain`和`routerChain`是拥有相同根节点的链条，前者是后者的子集。当链条的一部分被挂载到app上时，这部分的尾巴就会被打上一个`断点(point)`，当路由层挂载链条时，会利用断点把全局中间件剔除。这样既获得了类型提示，又保留了全局中间件，一箭双雕。

```:no-line-numbers
   全局挂载       断点              路由挂载
╭─────┴─────╮     ↓     ╭───────────┴───────────╮
a --------> b --------> c --------> d --------> e
╰─────┬─────╯
   appChain
╰──────────────────────┬────────────────────────╯
                  routerChain
```
