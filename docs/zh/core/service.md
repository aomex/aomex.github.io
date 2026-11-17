# 服务层

把「查库、调第三方、读写缓存」从路由 action 里挪出去，收成可复用的 **Service**；用 **combineServices** 拼成一个带类型的 services 袋，在 Web、Console、Cron 里同一套名字调用。

业务类继承 Service，对外只暴露普通 async 方法；连库、预热放在 onInit，释放放在 onDestroy（保持 protected，别给外面直接调）。

```typescript
import { Service } from '@aomex/common';

export default class UserService extends Service {
  private cache = new Map<number, { name: string }>();

  protected override async onInit(): Promise<void> { // [!code highlight]
    // 预热连接、读配置…
  }

  protected override async onDestroy(): Promise<void> {
    this.cache.clear();
  }

  async findById(id: number) {
    return this.cache.get(id) ?? null;
  }
}
```

用工厂 + combineServices 注册；**基础设施建议写进 eager**，应用一启动就先连上，别等第一条线上请求才初始化：

```typescript
import { combineServices } from '@aomex/common';

export const services = await combineServices( // [!code highlight]
  {
    user: () => import('./user.service.js'),
    cache: () => import('./cache.service.js'),
    logger: () => import('./logger.service.js'),
  },
  { eager: ['cache', 'logger'] },
);
```

接到 Web 后，services 的类型直接来自 combineServices 的键名和各个 Service 的**公开方法**：await services.user.findById(1) 有完整参数、返回值补全；onInit、onDestroy、private 字段**不会**出现在 services.user 上。同步写的 Service 方法，从外面调时类型上仍按 **Promise** 走，统一写 await 即可。

```typescript
import { WebApp } from '@aomex/web';

const app = new WebApp({
  services, // [!code highlight]
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

::: tip
别在业务里自己 new UserService() 却不交给 WebApp / ConsoleApp 的 services——关停时框架管不到，连接可能漏关。
:::

路由或中间件里：

```typescript
const user = await services.user.findById(1);
await services.logger.info('用户已查询', { userId: user?.name });
```

在别的文件 import { services } from './services/index.js'，不必再给模块做额外增强。

## 懒加载与测试注入

正式代码里用 `() => import('./xxx.service.js')` 推迟加载，冷启动更快：

```typescript
user: () => import('./user.service.js'),
```

测试里注入假实现可以写成异步工厂直接返回类：

```typescript
user: async () => FakeUserService,
```

::: warning
业务代码不要写成 `async () => UserService`。类已经跟着当前模块进内存了，懒加载形同虚设，还无端占运行时内存。正式环境一律 `() => import('./user.service.js')`；上面这种写法只留给测试注入。
:::

每个文件 `export default class XxxService` 最省心，loader 不用猜多个导出。

## eager

默认服务是**懒加载**的：第一次 `await services.xxx` 才实例化、跑 `onInit`。`eager` 里列出的名字会在 `combineServices` 返回前就建好——适合 Redis、日志这类「进程一起来就要就绪」的基础设施。

```typescript
{ eager: ['cache', 'logger'] },
```

本地试跑、极简 CLI 可以不写 eager。若在 A 的 `onInit` 里要 `await services.cache.xxx`，而 cache 没进 eager，连库会拖到第一次业务调用，启动阶段容易踩时序坑。

## 生命周期钩子

有些资源**不必**做成 Service、也不进 `services` 袋（例如模块级 PrismaClient、插件内部的 Redis store），但仍要在进程启动时连上、关停时断开。这时用 `registerLifecycle`：登记时立刻跑 `onInit`，`WebApp` / `ConsoleApp` 关停时再跑 `onDestroy`。

```typescript
import { registerLifecycle } from '@aomex/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

await registerLifecycle({ // [!code focus:4]
  onInit: () => prisma.$connect(),
  onDestroy: () => prisma.$disconnect(),
});
```

返回的函数用来**提前取消登记**（已关停或已取消后再调无效果）。`onInit` 失败则不会进入销毁队列。限流等插件内部也会用同一套钩子管 store，业务侧一般不用再为它们登记一遍。

已经放进 `combineServices` 的类继续用 `onInit` / `onDestroy` 即可，不必再套一层 `registerLifecycle`。

## 多袋合并

大仓按域拆多个 combineServices 再合并交给 App：

```typescript
const app = new WebApp({
  services: [domainA, domainB], // [!code highlight]
  logger: domainA.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

类名以 Service 结尾时，[`createRemember`](/zh/core/cache#缓存装饰器) 等会用去掉后缀后的名字区分缓存键（UserService → User）。

服务之间互相调用：在类里 import { services } from './index.js'，再 await services.other.method() 即可。类内 this.foo() 照常写；只有**跨类**才用 await services.other.foo()。

## 下一步

- 会话、`createRemember`：[缓存](/zh/core/cache)
- 全站日志出口：[日志](/zh/core/logger)
- 路由怎么写薄：[接口路由](/zh/web/router)