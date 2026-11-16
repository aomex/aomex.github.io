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

浏览器长连接容易被反代当成空闲掐断。**heartbeat** 周期性推注释行保活；**retry** 建议客户端断线后隔多少毫秒重连（写在连接建立时的 SSE 选项里）。本地短测可把 heartbeat 关掉；经 Nginx、CDN 的生产流要两项都对一下。

长连接经 Nginx、CDN 时保活；本地短测可关掉心跳：

```typescript
const sse = ctx.sse({
  heartbeat: 10_000,
  retry: 3_000,
});
```

| 选项 | 默认 / 习惯 | 什么时候用 |
| --- | --- | --- |
| `heartbeat` | 常见约 15s | 经 Nginx、CDN 的长连接保活；本地短测可 `heartbeat: false` |
| `retry` | 不设 | 希望浏览器断线后按毫秒间隔重连（通知流常设 `3000`） |

## 单条事件字段

每次 `send` / `emit` 可带 event 名、id、可选的单条 retry，以及 data 载荷。对象型 data 会自动 JSON 序列化；设 **id** 时浏览器重连会带 `Last-Event-ID`，便于续传。

| 字段 | 什么时候用 |
| --- | --- |
| `data` | 载荷；对象自动 JSON |
| `event` | 多种事件共存（`job` / `progress` / `ready`），前端按名监听 |
| `id` | 断线续传；重连带 `Last-Event-ID` |
| `retry` | 单条事件里临时改重连间隔 |

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

`stream` 把「边读上游、边 emit」包成一段生命周期：客户端断开时 **signal** abort，迭代结束会收尾，省得手写定时器和 close。`lastEventId` 来自请求头，用它从某条事件之后续推；`onClose` 里释放订阅、记审计。

```typescript
await sse.stream(async (emit, signal) => {
  // emit 等同 sse.send；signal 断开即 abort
});
```

| 成员 | 常见做法是怎么用 |
| --- | --- |
| `lastEventId` | 从该 id 之后继续推 |
| `signal` | 传给 Redis 订阅、队列 watch，客户端走了上游也停 |
| `onClose(fn)` | 释放订阅、记审计 |
| `close()` | 任务结束主动关流；`stream` 结束会自动调 |

```typescript
const after = sse.lastEventId; // [!code highlight]
sse.onClose(() => {
  subscription.unsubscribe();
});
sse.close();
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