---
outline: deep
---

# 异步链路追踪

访问日志只会告诉你「这一条请求 800ms」。要找出**哪几个 await 吃了时间**，在本请求里收成一棵树——适合慢接口排查、Service 里一串 IO 剖分。日常 CRUD 不必默认依赖；要上标准全链路追踪可看 OpenTelemetry，本包更轻、偏应用内排障。

## 全请求 traceMiddleware

安装（需要时再装）：

```bash
pnpm add @aomex/async-trace
```

全请求包一层中间件：

```typescript
import { asyncTrace, traceMiddleware } from '@aomex/async-trace';

mount: [
  traceMiddleware('request', (record) => { // [!code highlight]
    if (record.duration > 500) {
      void asyncTrace.toStack([record]);
    }
  }),
  routers('./src/routers'),
],
```

没挂 traceMiddleware 却指望 ctx.asyncTrace 时，类型和运行时都不会有根记录；要么挂中间件，要么只用局部 traceBlock。

Service 里局部剖分：

```typescript
import { traceBlock } from '@aomex/async-trace';

const data = await traceBlock('loadUser', async () => { // [!code highlight]
  const profile = await db.profile.find();
  const prefs = await db.prefs.find();
  return { profile, prefs };
});
```

方法级用装饰器（类方法里多个 await 时比手写 traceBlock 干净）：

```typescript
import { traceMethod } from '@aomex/async-trace';

class UserService {
  @traceMethod() // [!code highlight]
  async load() {
    return [];
  }
}
```

未传 label 时默认类似 ClassName.methodName，看栈时好认。

挂了 traceMiddleware 后，Web 上下文会合并 **AsyncTraceMiddlewareProps**：请求里可用 **ctx.asyncTrace.record**（具体字段按类型提示来）。traceMiddleware 是 **mixin** 中间件，不是 `middleware.web` 专属工厂，但可以直接放进 Web mount；Console / command mount 同样能挂。`asyncTrace.run(label, callback)` 在已开启的树里再开子节点；嵌套后 toStack 打出来是缩进结构。记录里一般有 label、duration、parent / children、error 等——排障时盯 duration 和 label 就够的情况很多。

## 挂载层级与回调

| 场景 | 用法 |
| --- | --- |
| 整站 HTTP | `WebApp.mount: [traceMiddleware('http')]` |
| 某一组 API | `Router.mount: [traceMiddleware('api-v1')]` |
| 控制台任务 | `ConsoleApp` / command 的 `mount` 同样可挂 |
| 热点方法 | `@traceMethod()` 或 `traceBlock` |
| 慢请求落日志 | `traceMiddleware` 第二参数 `callback`，别在生产热路径无脑 `console.log` 全量栈 |

::: warning
生产环境全量打栈、无阈值有运行时开销；在 callback 里按 duration 或采样对接日志系统。
:::

与 [@aomex/http-access-log](/zh/plugins/http-access-log) 互补：访问日志记总耗时，链路追踪拆子步骤。本包不替代 OpenTelemetry 等分布式 trace，跨服务还得用标准方案。

## 相关

- 中间件顺序：[Web 应用](/zh/web/)、[自定义中间件](/zh/advanced/middleware)
- 日志带上 requestId：[日志 · withBindings](/zh/core/logger#请求级上下文withbindings)