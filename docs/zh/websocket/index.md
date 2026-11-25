---
outline: deep
---

# WebSocket 应用入口

聊天、订单状态、协作光标——这些都需要服务端主动推给浏览器。WebSocket 应用就是干这个的：你先像搭 Web 一样建一个 `WebsocketApp`，再把它挂到**同一个** HTTP 端口上。客户端连上来之后按「事件名」进业务；订单写进库成功后，你还可以在普通 HTTP 路由里调同一份 `ws`，把消息推给还在线的人。

先说清楚一件事：消息是**尽力送达**。`await ws.room(...).send(...)` 结束，只表示框架已经往外写（或丢给 Redis），**不保证**对方一定收到，也没有自动重发、离线信箱。重要数据照样落库；客户端重连后用 HTTP 把漏掉的状态补回来。

## 装好依赖，写出第一份实例

假定你已经有一个能跑的 [Web 应用](/zh/web/)。再装实时相关包：

```bash
pnpm add @aomex/websocket @aomex/websocket-ws-transport
```

`WebsocketApp` 请单独放一个文件、并 `export` 出去。HTTP 入口、路由、Console 指令都去 import 这一份——**不要**在每个文件里 `new` 一次，否则推送会对不上连接。

```typescript
// src/ws.ts
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';
import { logger } from '@/services/logger.service';

export const ws = new WebsocketApp({ // [!code focus:8]
  logger, // [!code highlight]
  language: { mode: 'fixed', language: 'zh-CN' },
  path: '/ws',
  transport: new WsTransport(),
  mount: [channels('./src/channels')], // [!code highlight]
});
```

`logger`、`language`、`transport` 都是必填；漏了编译器会拦。

- `logger`：和 Web / Console 传**同一个** `Logger` 实例。传输层初始化失败、往房间扇出时出错，都会打到这里。
- `language`：管这条连接上的框架文案（握手失败、非法帧关闭原因、限流 / 校验失败回推的话）。上面用的是 `fixed`——后台、内网、单语种最省事。
- `mount`：先挂 `channels('./src/channels')`，和 Web 里挂 `routers('./src/routers')` 是同一类事。Channel 怎么写见 [事件路由](/zh/websocket/channel)。

公开多端要按握手请求头协商语言时，改成 `dynamic`，并给一个 `fallback`：

```typescript
language: {
  mode: 'dynamic', // [!code highlight]
  header: 'accept-language',
  fallback: 'zh-CN',
},
```

`header` 默认就是 `accept-language`（按 `q` 排序）；App 自定义头可写成 `x-language`。语言码写 `zh-CN`、`en-US`（连字符）。

::: tip
你在 **HTTP 路由**里调 `ws.room().send()` 时，跟的是**那次 HTTP 请求**的语言，不是某条长连接当初握手时的语言。
:::

## 挂到 HTTP 端口上

WebSocket 不能自己再开一个端口听——它要借 Web 那个 `http.Server` 做协议升级。所以进程入口不要再用 `app.listen(3000)` 一把梭，改成：先 `app.http({})` 拿到 server → `ws.attach` → 再 `listen`。

```typescript
// src/web.ts —— 真正启动进程的入口
import { routers, WebApp } from '@aomex/web';
import { services } from '@/services';
import { ws } from '@/ws';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [routers('./src/routers')],
});

const server = app.http({}); // [!code focus:3]
ws.attach(app, server); // [!code highlight]
server.listen(3000, () => {
  console.log('HTTP + WebSocket 已启动');
});
```

`attach` 必须在 `listen` **之前**；同一份 `ws` 只能 attach 一次，再调会直接抛错。进程收到关停信号时，框架会一边关 HTTP，一边把 WebSocket 连接排空，你不用自己写两套清理。

::: warning
别在 `src/ws.ts` 模块顶层写 `ws.attach(...)`。Console 指令也会 import `ws`，一 import 就会再走一遍 attach，两个进程各搞各的，推送全乱。
:::

启动：

```bash
node --import tsx/esm --watch src/web.ts
```

浏览器控制台先试连通（路径默认 `/ws`）：

```typescript
const socket = new WebSocket('ws://localhost:3000/ws');
socket.onopen = () => {
  socket.send(JSON.stringify({ event: 'ping', data: {} }));
};
socket.onmessage = (ev) => {
  console.log(ev.data);
};
```

还没有对应 Channel 时，这条消息可能被默默丢掉（默认 `unknownEvent: 'ignore'`）。先把通道跑通，再去写事件处理。

## 客户端连哪、用什么协议

`path` 决定浏览器连哪里。默认 `/ws`；改了之后地址要一起改：

```typescript
path: '/realtime',
// 浏览器：new WebSocket('ws://localhost:3000/realtime')
```

Socket.IO 客户端则是 `io('http://localhost:3000', { path: '/realtime' })`。

`transport` **必填**，负责握手升级和收发每一帧。本地入门用 `new WsTransport()` 就够；以后要换成 Socket.IO，只换这一行，Channel 业务不用动——详见 [传输层](/zh/websocket/transport)。

`hub` **可不填**。默认内存 Hub，房间和广播只在**当前进程**里有效，单机开发完全够用。上了多副本、或者 Console 进程也要推消息给 Web 上的人，再换成 Redis Hub——见 [多机 Hub](/zh/websocket/hub)。

两件事互不绑定：换传输不必换 Hub；上多机只换 Hub。若用了 Socket.IO，也**不要**再挂 Socket.IO 自带的 Redis adapter，房间只认 aomex 的 Hub。

## 握手拦一把，再挂全局中间件

连接刚要升级时，可以用 `verify` 做粗门槛：入参是普通的 Web 请求对象，能读 Cookie、头、IP。返回 `true` 放行；`false` 或 HTTP 状态码（如 `401`）则拒绝握手。细到某个事件要不要权限，放到 Channel 的 mount 里更合适。

```typescript
import { logger } from '@/services/logger.service';

export const ws = new WebsocketApp({
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  transport: new WsTransport(),
  verify: (request) => { // [!code focus:3]
    return request.cookies['sid'] ? true : 401;
  },
  mount: [channels('./src/channels')],
});
```

`mount` 和 `WebApp.mount` 一样是洋葱队列。通常**最后**挂 `channels(...)`，前面可以挂访问日志、限速、滥用检查。这里只能挂 `middleware.socket` / `middleware.mixin`，别把 HTTP 专用中间件塞进来。

```typescript
mount: [
  // 访问日志、限速……见侧栏「常用中间件」
  channels('./src/channels'),
],
```

## 联调：未知事件与单帧大小

客户端乱发一个你没注册的事件名时，默认 `unknownEvent: 'ignore'`——静默丢掉。联调阶段可以开成 `'error'`，框架会回推一条 `event: 'error'` 的帧，前端立刻能发现拼错事件名；上线后多数人继续用 `ignore`。

```typescript
unknownEvent: 'error', // 联调时打开
```

`maxPayload` 是单帧最大字节，默认 1MiB。过大的包占内存，底层会直接断开。上传大 JSON、截图 base64 之类需要更大时再调；多数聊天文本保持默认即可。

```typescript
maxPayload: 256 * 1024, // 256KiB，收紧一点
```

## 看在线情况

想在人数变化、入站成败时立刻知道，挂 `onMetric`：有事就回调。回调里抛错只会打 warn，不影响收发。

```typescript
import { logger } from '@/services/logger.service';

export const ws = new WebsocketApp({
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  transport: new WsTransport(),
  mount: [channels('./src/channels')],
  onMetric: (e) => { // [!code focus:5]
    if (e.type === 'online') {
      console.log('当前在线', e.online);
    }
  },
});
```

也可以自己定时拉一份本机快照（在线数、房间数）。这是**单机**数据，不是全集群汇总：

```typescript
setInterval(async () => {
  const s = await ws.stats();
  console.log(s.online, s.rooms);
}, 10_000);
```

## 在 HTTP 路由里推消息

这是最常见的生产用法：接口写完库 → 推给还在线的人 → HTTP 照常返回。

连接刚建立时，框架只会自动加入一个叫 `client.id` 的房间（等于「只推给这一条连接」）。业务房间（大厅、订单号）要在 Channel 里自己 `join`，否则 `room('lobby').send` 没人收得到。

```typescript
// src/routers/order.ts
import { Router } from '@aomex/web';
import { ws } from '@/ws';

export const router = new Router();

router.post('/orders', { // [!code focus:8]
  action: async (ctx) => {
    const order = await createOrder(/* ... */);
    await ws.room(`order:${order.id}`).send('order.updated', order); // [!code highlight]
    ctx.send(order);
  },
});
```

几种推法：

```typescript
// 所有在线连接
await ws.all.send('system.notice', { text: '维护 5 分钟' });

// 某个 client.id（点对点）
await ws.room(clientId).send('dm', { text: 'hi' });

// 全员，但排除某个人
await ws.all.send('notice', { text: '...' }, { except: clientId });
```

`except` 可以传连接对象（有 `id` 就行），也可以直接传 id 字符串。房间名不能是空字符串，也不能含 `\0`，否则立刻抛错。

::: tip
默认的内存 Hub **跨不出进程**。Console 里 `import { ws }` 再 `send`，如果 Console 和 Web 不是同一个 Node 进程，消息到不了浏览器——两边都换成同一套 Redis Hub，见 [多机 Hub](/zh/websocket/hub)。
:::

## 和 Web、Console 放一起看

你已经会的三件事，对照一下就不容易混：

| | Web | WebSocket | Console |
| --- | --- | --- | --- |
| 怎么匹配 | 方法 + 路径 | 事件名 | 指令名 |
| 入参怎么校验 | query / body / params | `payload()` | `options()` |
| 出口怎么声明 | `response()` | `emit()` | — |
| 进程怎么活着 | listen 一直挂着 | attach 到同一个 Server | `run` 完就退出 |

查库、发信继续放 [services](/zh/core/service)；实时进出放 Channel；「写库成功后再推一把」放在路由或 Console 指令里调 `ws.room`。

## 下一步

- [事件路由 Channel](/zh/websocket/channel) —— 先写一个能回 `pong` 的事件
- [入站 payload](/zh/websocket/payload) / [出站 emit](/zh/websocket/emit)
- [传输层](/zh/websocket/transport) —— 要不要上 Socket.IO
- [多机 Hub](/zh/websocket/hub) —— 多副本或 Console 跨进程推送
