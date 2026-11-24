---
outline: deep
---

# 异步链路追踪

访问日志只会告诉你「这一条请求 800ms」。要找出**哪几个 await 吃了时间**，在本请求里收成一棵树——适合慢接口排查、Service 里一串 IO 剖分。日常 CRUD 不必默认依赖；要上标准全链路追踪可看 OpenTelemetry，本包更轻、偏应用内排障。

```bash
pnpm add @aomex/async-trace
```

## 全请求包一层

把 `traceMiddleware` 挂进 `WebApp.mount`（或某一组 Router）：每个请求开一棵根节点；第二参数是请求结束后的回调，适合「只打慢请求」再对接日志。

```typescript
import { asyncTrace, traceMiddleware } from '@aomex/async-trace';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:8]
    traceMiddleware('request', (record) => {
      if (record.duration > 500) {
        void asyncTrace.toStack([record]);
      }
    }),
    routers('./src/routers'),
  ],
});
```

挂了之后，Web 上下文会合并 **AsyncTraceMiddlewareProps**：请求里可用 `ctx.asyncTrace.record`（具体字段按类型提示来）。没挂却指望 `ctx.asyncTrace` 时，类型和运行时都不会有根记录；要么挂中间件，要么只用局部 `traceBlock`。

`traceMiddleware` 是 **mixin** 中间件，不是 `middleware.web` 专属工厂，但可以直接放进 Web mount；Console / command mount 同样能挂。某一组 API 慢、不想全站开销时，挂到那个 Router 的 mount 即可。

::: warning
生产环境全量打栈、无阈值有运行时开销；在 callback 里按 duration 或采样对接日志系统。
:::

## Service 里剖分热点

全请求只能看到总耗时；要拆「哪一次查库慢」，在 Service 里用 `traceBlock` 包住一段 await。嵌套后 `toStack` 打出来是缩进结构。

```typescript
import { traceBlock } from '@aomex/async-trace';

async loadUser(id: number) {
  return traceBlock('loadUser', async () => { // [!code focus:5]
    const profile = await db.profile.find(id);
    const prefs = await db.prefs.find(id);
    return { profile, prefs };
  });
}
```

类方法里多个 await 时，装饰器比手写 `traceBlock` 干净；未传 label 时默认类似 `ClassName.methodName`，看栈时好认：

```typescript
import { traceMethod } from '@aomex/async-trace';

class UserService {
  @traceMethod() // [!code highlight]
  async load() {
    return [];
  }
}
```

`asyncTrace.run(label, callback)` 在已开启的树里再开子节点。记录里一般有 label、duration、parent / children、error 等——排障时盯 duration 和 label 就够的情况很多。

与 [@aomex/access-log](/zh/plugins/http-access-log) 互补：访问日志记总耗时，链路追踪拆子步骤。本包不替代 OpenTelemetry 等分布式 trace，跨服务还得用标准方案。

## 相关

- 中间件顺序：[Web 应用](/zh/web/)、[自定义中间件](/zh/advanced/middleware)
- 日志带上 requestId：[日志 · withBindings](/zh/core/logger#请求级上下文withbindings)
