---
outline: deep
---

# 多机 Hub

Hub 记的是「谁在哪个房间」以及「广播时怎么扇出去」。默认的内存 Hub 只认识**当前这个 Node 进程**里的连接——本地开发完全够用。

什么时候必须换 Redis Hub？

- 线上跑了多个 Web 副本，用户可能打到不同机器
- Console（或其它进程）也要 `ws.room(...).send`，推给 Web 进程上还连着的浏览器

传输层（ws / Socket.IO）和 Hub **各管各的**：换客户端协议不必换 Hub；上多机只换 Hub。

消息仍然是尽力送达：Redis `PUBLISH` 成功，不等于每一台机器都扇完，更不等于浏览器已经显示。

## 默认就行：MemoryHub

不传 `hub` 时自动用内存实现。单机、本机联调保持这样即可——上面入口篇的 `new WebsocketApp({ ... })` 已经是这个状态。

记住限制：进程 A 里 `room().send`，**打不进**进程 B 上的连接。Web 和 Console 若是两个进程，Console 里怎么 send 浏览器也收不到。

## 上多机：RedisHub

```bash
pnpm add @aomex/websocket-redis-hub
```

每台机器仍在本地维护「本机有哪些连接、各自在哪些房间」；跨机器的广播走 Redis Pub/Sub。某个房间本机没人了，就会退订对应频道，避免空订。

`host` / `port` / 密码等和平时配 ioredis 一样。多个项目共用一个 Redis 时，务必改 `channel`（Pub/Sub 频道前缀，默认 `aomex:websocket:hub`）成不冲突的名字。`fanoutBatchSize` 是本机一次扇出多少连接，一般不用动。

```typescript
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';
import { RedisHub } from '@aomex/websocket-redis-hub';

export const ws = new WebsocketApp({
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  transport: new WsTransport(),
  hub: new RedisHub({ // [!code focus:5]
    host: '127.0.0.1',
    port: 6379,
    channel: 'aomex:websocket:hub',
    fanoutBatchSize: 512,
  }),
  mount: [channels('./src/channels')],
});
```

实际频道是 `{前缀}:a`（发给所有人）和 `{前缀}:r:{房间名}`。**所有要互通的进程**（各个 Web 副本、要推送的 Console）必须：同一个 Redis、同一个 `channel` 前缀。

::: warning
用了 Socket.IO 传输，也**不要**再挂 Socket.IO 官方的 Redis adapter。房间和广播只认 aomex 的 `hub`，叠两套等于埋雷。
:::

## Console 跨进程推一把

套路和入口篇一样：`ws` 单独文件导出；Web 进程负责 `attach`；Console **只 import，绝不 attach**。两边构造时都传入同一套 `RedisHub` 配置：

```typescript
// Console 指令里
import { ws } from '../ws.js';

await ws.room(`order:${orderId}`).send('order.updated', order);
await ws.all.send('system.notice', { text: '今晚 23:00 维护' });
```

发送前会等到 Hub 就绪。当时不在线的客户端收不到——下次打开页面用 HTTP 把状态拉齐即可。

## 下一步

- [应用入口](/zh/websocket/) —— attach 与推送写法
- [传输层](/zh/websocket/transport)
- [多进程与扩容](/zh/advanced/cluster)
