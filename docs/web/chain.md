# 链条的作用

当我们写的接口越来越多，挂载的中间件的逻辑也可能出现重复劳动的情况。如果某些中间件不是所有路由都能使用，那么它就不能被挂载到app上，此时你需要在各个路由挨个挂载。繁琐不说，还容易遗漏，后期维护修改也得小心翼翼

| 接口  | 挂载中间件                           |
| ----- | ------------------------------------ |
| api-1 | gzip - logger - cors - etag - custom |
| api-2 | gzip - logger - cors - etag - custom |
| api-3 | gzip - logger - cors - etag - jwt    |
| api-4 | gzip - logger - cors - etag - jwt    |
| api-5 | gzip - logger                        |

针对这几个接口，我们发现它们之间使用了重复的中间件，现在改造成链条试一试

```typescript
// ./src/chain/web.chain
import { chain } from '@aomex/core';

export const appChain = chain.web.mount(gzip).mount(logger);
export const publicChain = appChain.mount(cors).mount(etag);
export const authChain = publicChain.mount(jwt);

// ./src/index.ts
const app = new WebApp();
app.mount(appChain);
```

| 接口  | 挂载中间件                               | 挂载链条             |
| ----- | ---------------------------------------- | -------------------- |
| api-1 | ~~gzip - logger - cors - etag - custom~~ | publicChain - custom |
| api-2 | ~~gzip - logger - cors - etag - custom~~ | publicChain - custom |
| api-3 | ~~gzip - logger - cors - etag - jwt~~    | authChain            |
| api-4 | ~~gzip - logger - cors - etag - jwt~~    | authChain            |
| api-5 | ~~gzip - logger~~                        | -                    |

清爽多了，公共的中间件就应该抽取出来。**全局公共的中间件就用链条挂载到app上，而局部公共的中间件就设置新的链条等待路由挂载**

```typescript
export const router1 = new Router({
  // 组内共享
  mount: publicChain.mount(custom).mount(otherChain),
});
router1.get('api-1');
router1.get('api-2', {
  mount: [localMiddleware],
});

export const router2 = new Router({
  // 组内共享
  mount: authChain.mount(otherMiddleware),
});
router2.get('api-3');
router2.get('api-4');

export const router3 = new Router();
router3.get('api-5');
```

> 链条属于中间件容器，初衷是为了让路由逻辑有完整的类型提示
