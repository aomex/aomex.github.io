---
outline: deep
---

# 服务端推送 SSE

做一条「服务端持续往下推、浏览器用 EventSource 听」的 GET 接口：在 action 里调 ctx.sse()，用 stream 或 send 往外扔事件。适合通知、进度条、行情刷新；双向杂乱帧再考虑 WebSocket。

```typescript
import { Router } from '@aomex/web';

export const router = new Router();

router.get('/events', { // [!code focus:13]
  action: async (ctx) => {
    const sse = ctx.sse({ retry: 3_000 }); // [!code highlight]
    await sse.stream(async (emit, signal) => {
      for await (const item of watchEvents({
        after: sse.lastEventId,
        signal,
      })) {
        emit({ id: String(item.id), event: 'item', data: item });
      }
    });
  },
});
```

优先用 stream：客户端断开时 signal 会 abort，迭代结束会自动收尾，少写一堆 close / 清定时器。

`ctx.sse()` 与 `ctx.response.sse()` 等价；须在**还没写出响应头**时调用，否则直接抛错。SSE 占住整条响应，别在同一路由末尾再 ctx.send JSON。打开后状态码 200、Content-Type: text/event-stream。emit / send 的 data 传对象时会 JSON 序列化；lastEventId 来自请求头，首次连接多半是 undefined。

## heartbeat 与 retry

浏览器长连接容易被反代当成空闲掐断。`heartbeat` 周期性推注释行保活（常见约 15s；本地短测可 `heartbeat: false`）。`retry` 建议客户端断线后隔多少毫秒重连（通知流常设 `3000`）。经 Nginx、CDN 的生产流要两项都对一下。

```typescript
const sse = ctx.sse({
  heartbeat: 10_000,
  retry: 3_000,
});
```

## 单条事件字段

每次 `send` / `emit` 可带 event 名、id、可选的单条 retry，以及 data 载荷。对象型 data 会自动 JSON 序列化；设 **id** 时浏览器重连会带 `Last-Event-ID`，便于续传。多种事件共存（`job` / `progress` / `ready`）时前端按 `event` 名监听。

```typescript
sse.send({ data: { hello: 'world' } });
sse.send({ event: 'ready' });
sse.send({
  id: '42', // [!code highlight]
  event: 'job',
  retry: 5_000,
  data: 1,
});
```

## stream、续传与收尾

`stream` 把「边读上游、边 emit」包成一段生命周期：客户端断开时 **signal** abort（传给 Redis 订阅、队列 watch），迭代结束会收尾，省得手写定时器和 close。`lastEventId` 来自请求头，用它从某条事件之后续推；`onClose` 里释放订阅、记审计；任务结束也可主动 `close()`（`stream` 结束会自动调）。

```typescript
await sse.stream(async (emit, signal) => { // [!code focus:8]
  const after = sse.lastEventId;
  sse.onClose(() => {
    subscription.unsubscribe();
  });
  for await (const item of watchEvents({ after, signal })) {
    emit({ id: String(item.id), event: 'item', data: item });
  }
});
```


连接已关或不可写时，send 会静默忽略——别当成「一定送达」。要断线续传就给事件设稳定 id，否则 lastEventId 对不上、重连会从头发。

::: warning
长连接经 Nginx 等反代时，除框架的 X-Accel-Buffering: no 外，心跳和反代缓冲超时仍要对一下配置，否则容易被当空闲掐断。
:::

## 与 response()、OpenAPI

OpenAPI 需要知道这条 GET 出口是 `text/event-stream`，所以在 mount 里挂 `response({ contentType: 'text/event-stream', ... })`。这只服务文档和类型，**不能替代** action 里的 `ctx.sse()` 写帧。

```typescript
import { rule } from '@aomex/common';
import { response } from '@aomex/web';

response({
  statusCode: 200,
  contentType: 'text/event-stream', // [!code highlight]
  content: rule.string(),
  description: 'SSE 事件流',
});
```

这只帮文档和类型提示，**不能代替** `ctx.sse()` 的帧协议。压缩中间件一般会跳过 text/event-stream，见 [Compress](/zh/plugins/compress)。

EventSource 只能 GET，跨站带 cookie 时要配好 [CORS](/zh/plugins/cors)。

## 下一步

- [约束响应](/zh/web/response)（流式出口的 contentType 声明）
- [输入输出总览](/zh/web/)（和其它 Web 中间件一起挂载）
- [Compress](/zh/plugins/compress)（别压坏事件流）