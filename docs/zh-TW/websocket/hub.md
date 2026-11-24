---
outline: deep
---

# 多機 Hub

Hub 記的是「誰在哪個房間」以及「廣播時怎麼扇出去」。預設的記憶體 Hub 只認識**當前這個 Node 程序**裡的連線——本地開發完全夠用。

什麼時候必須換 Redis Hub？

- 線上跑了多個 Web 副本，使用者可能打到不同機器
- Console（或其它程序）也要 `ws.room(...).send`，推給 Web 程序上還連著的瀏覽器

傳輸層（ws / Socket.IO）和 Hub **各管各的**：換客戶端協議不必換 Hub；上多機只換 Hub。

訊息仍然是盡力送達：Redis `PUBLISH` 成功，不等於每一臺機器都扇完，更不等於瀏覽器已經顯示。

## 預設就行：MemoryHub

不傳 `hub` 時自動用記憶體實現。單機、本機聯調保持這樣即可——上面入口篇的 `new WebsocketApp({ ... })` 已經是這個狀態。

記住限制：程序 A 裡 `room().send`，**打不進**程序 B 上的連線。Web 和 Console 若是兩個程序，Console 裡怎麼 send 瀏覽器也收不到。

## 上多機：RedisHub

```bash
pnpm add @aomex/websocket-redis-hub
```

每臺機器仍在本地維護「本機有哪些連線、各自在哪些房間」；跨機器的廣播走 Redis Pub/Sub。某個房間本機沒人了，就會退訂對應頻道，避免空訂。

`host` / `port` / 密碼等和平時配 ioredis 一樣。多個專案共用一個 Redis 時，務必改 `channel`（Pub/Sub 頻道字首，預設 `aomex:websocket:hub`）成不衝突的名字。`fanoutBatchSize` 是本機一次扇出多少連線，一般不用動。

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

實際頻道是 `{字首}:a`（發給所有人）和 `{字首}:r:{房間名}`。**所有要互通的程序**（各個 Web 副本、要推送的 Console）必須：同一個 Redis、同一個 `channel` 字首。

::: warning
用了 Socket.IO 傳輸，也**不要**再掛 Socket.IO 官方的 Redis adapter。房間和廣播只認 aomex 的 `hub`，疊兩套等於埋雷。
:::

## Console 跨程序推一把

套路和入口篇一樣：`ws` 單獨檔案匯出；Web 程序負責 `attach`；Console **只 import，絕不 attach**。兩邊構造時都傳入同一套 `RedisHub` 配置：

```typescript
// Console 指令里
import { ws } from '../ws.js';

await ws.room(`order:${orderId}`).send('order.updated', order);
await ws.all.send('system.notice', { text: '今晚 23:00 维护' });
```

傳送前會等到 Hub 就緒。當時不線上的客戶端收不到——下次開啟頁面用 HTTP 把狀態拉齊即可。

## 下一步

- [應用入口](/zh-TW/websocket/) —— attach 與推送寫法
- [傳輸層](/zh-TW/websocket/transport)
- [多程序與擴容](/zh-TW/advanced/cluster)
