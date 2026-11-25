---
outline: deep
---

# WebSocket 應用入口

聊天、訂單狀態、協作游標——這些都需要服務端主動推給瀏覽器。WebSocket 應用就是幹這個的：你先像搭 Web 一樣建一個 `WebsocketApp`，再把它掛到**同一個** HTTP 埠上。客戶端連上來之後按「事件名」進業務；訂單寫進庫成功後，你還可以在普通 HTTP 路由裡調同一份 `ws`，把訊息推給還線上的人。

先說清楚一件事：訊息是**盡力送達**。`await ws.room(...).send(...)` 結束，只表示框架已經往外寫（或丟給 Redis），**不保證**對方一定收到，也沒有自動重發、離線信箱。重要資料照樣落庫；客戶端重連後用 HTTP 把漏掉的狀態補回來。

## 裝好依賴，寫出第一份實例

假定你已經有一個能跑的 [Web 應用](/zh-TW/web/)。再裝即時相關包：

```bash
pnpm add @aomex/websocket @aomex/websocket-ws-transport
```

`WebsocketApp` 請單獨放一個檔案、並 `export` 出去。HTTP 入口、路由、Console 指令都去 import 這一份——**不要**在每個檔案裡 `new` 一次，否則推送會對不上連線。

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

`logger`、`language`、`transport` 都是必填；漏了編譯器會攔。

- `logger`：和 Web / Console 傳**同一個** `Logger` 實例。傳輸層初始化失敗、往房間扇出時出錯，都會打到這裡。
- `language`：管這條連線上的框架文案（握手失敗、非法幀關閉原因、限流 / 校驗失敗回推的話）。上面用的是 `fixed`——後臺、內網、單語種最省事。
- `mount`：先掛 `channels('./src/channels')`，和 Web 裡掛 `routers('./src/routers')` 是同一類事。Channel 怎麼寫見 [事件路由](/zh-TW/websocket/channel)。

公開多端要按握手請求頭協商語言時，改成 `dynamic`，並給一個 `fallback`：

```typescript
language: {
  mode: 'dynamic', // [!code highlight]
  header: 'accept-language',
  fallback: 'zh-CN',
},
```

`header` 預設就是 `accept-language`（按 `q` 排序）；App 自定義頭可寫成 `x-language`。語言碼寫 `zh-CN`、`en-US`（連字元）。

::: tip
你在 **HTTP 路由**裡調 `ws.room().send()` 時，跟的是**那次 HTTP 請求**的語言，不是某條長連線當初握手時的語言。
:::

## 掛到 HTTP 埠上

WebSocket 不能自己再開一個埠聽——它要借 Web 那個 `http.Server` 做協議升級。所以程序入口不要再用 `app.listen(3000)` 一把梭，改成：先 `app.http({})` 拿到 server → `ws.attach` → 再 `listen`。

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

`attach` 必須在 `listen` **之前**；同一份 `ws` 只能 attach 一次，再調會直接拋錯。程序收到關停訊號時，框架會一邊關 HTTP，一邊把 WebSocket 連線排空，你不用自己寫兩套清理。

::: warning
別在 `src/ws.ts` 模組頂層寫 `ws.attach(...)`。Console 指令也會 import `ws`，一 import 就會再走一遍 attach，兩個程序各搞各的，推送全亂。
:::

啟動：

```bash
node --import tsx/esm --watch src/web.ts
```

瀏覽器控制台先試連通（路徑預設 `/ws`）：

```typescript
const socket = new WebSocket('ws://localhost:3000/ws');
socket.onopen = () => {
  socket.send(JSON.stringify({ event: 'ping', data: {} }));
};
socket.onmessage = (ev) => {
  console.log(ev.data);
};
```

還沒有對應 Channel 時，這條訊息可能被默默丟掉（預設 `unknownEvent: 'ignore'`）。先把通道跑通，再去寫事件處理。

## 客戶端連哪、用什麼協議

`path` 決定瀏覽器連哪裡。預設 `/ws`；改了之後地址要一起改：

```typescript
path: '/realtime',
// 浏览器：new WebSocket('ws://localhost:3000/realtime')
```

Socket.IO 客戶端則是 `io('http://localhost:3000', { path: '/realtime' })`。

`transport` **必填**，負責握手升級和收發每一幀。本地入門用 `new WsTransport()` 就夠；以後要換成 Socket.IO，只換這一行，Channel 業務不用動——詳見 [傳輸層](/zh-TW/websocket/transport)。

`hub` **可不填**。預設記憶體 Hub，房間和廣播只在**當前程序**裡有效，單機開發完全夠用。上了多副本、或者 Console 程序也要推訊息給 Web 上的人，再換成 Redis Hub——見 [多機 Hub](/zh-TW/websocket/hub)。

兩件事互不繫結：換傳輸不必換 Hub；上多機只換 Hub。若用了 Socket.IO，也**不要**再掛 Socket.IO 自帶的 Redis adapter，房間只認 aomex 的 Hub。

## 握手攔一把，再掛全域性中介軟體

連線剛要升級時，可以用 `verify` 做粗門檻：入參是普通的 Web 請求物件，能讀 Cookie、頭、IP。返回 `true` 放行；`false` 或 HTTP 狀態碼（如 `401`）則拒絕握手。細到某個事件要不要許可權，放到 Channel 的 mount 裡更合適。

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

`mount` 和 `WebApp.mount` 一樣是洋蔥佇列。通常**最後**掛 `channels(...)`，前面可以掛訪問日誌、限速、濫用檢查。這裡只能掛 `middleware.socket` / `middleware.mixin`，別把 HTTP 專用中介軟體塞進來。

```typescript
mount: [
  // 访问日志、限速……见侧栏「常用中间件」
  channels('./src/channels'),
],
```

## 聯調：未知事件與單幀大小

客戶端亂髮一個你沒註冊的事件名時，預設 `unknownEvent: 'ignore'`——靜默丟掉。聯調階段可以開成 `'error'`，框架會回推一條 `event: 'error'` 的幀，前端立刻能發現拼錯事件名；上線後多數人繼續用 `ignore`。

```typescript
unknownEvent: 'error', // 联调时打开
```

`maxPayload` 是單幀最大位元組，預設 1MiB。過大的包占記憶體，底層會直接斷開。上傳大 JSON、截圖 base64 之類需要更大時再調；多數聊天文本保持預設即可。

```typescript
maxPayload: 256 * 1024, // 256KiB，收紧一点
```

## 看線上情況

想在人數變化、入站成敗時立刻知道，掛 `onMetric`：有事就回調。回撥裡拋錯只會打 warn，不影響收發。

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

也可以自己定時拉一份本機快照（線上數、房間數）。這是**單機**資料，不是全叢集彙總：

```typescript
setInterval(async () => {
  const s = await ws.stats();
  console.log(s.online, s.rooms);
}, 10_000);
```

## 在 HTTP 路由裡推訊息

這是最常見的生產用法：介面寫完庫 → 推給還線上的人 → HTTP 照常返回。

連線剛建立時，框架只會自動加入一個叫 `client.id` 的房間（等於「只推給這一條連線」）。業務房間（大廳、訂單號）要在 Channel 裡自己 `join`，否則 `room('lobby').send` 沒人收得到。

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

幾種推法：

```typescript
// 所有在线连接
await ws.all.send('system.notice', { text: '维护 5 分钟' });

// 某个 client.id（点对点）
await ws.room(clientId).send('dm', { text: 'hi' });

// 全员，但排除某个人
await ws.all.send('notice', { text: '...' }, { except: clientId });
```

`except` 可以傳連線物件（有 `id` 就行），也可以直接傳 id 字串。房間名不能是空字串，也不能含 `\0`，否則立刻拋錯。

::: tip
預設的記憶體 Hub **跨不出程序**。Console 裡 `import { ws }` 再 `send`，如果 Console 和 Web 不是同一個 Node 程序，訊息到不了瀏覽器——兩邊都換成同一套 Redis Hub，見 [多機 Hub](/zh-TW/websocket/hub)。
:::

## 和 Web、Console 放一起看

你已經會的三件事，對照一下就不容易混：

| | Web | WebSocket | Console |
| --- | --- | --- | --- |
| 怎麼匹配 | 方法 + 路徑 | 事件名 | 指令名 |
| 入參怎麼校驗 | query / body / params | `payload()` | `options()` |
| 出口怎麼宣告 | `response()` | `emit()` | — |
| 程序怎麼活著 | listen 一直掛著 | attach 到同一個 Server | `run` 完就退出 |

查庫、發信繼續放 [services](/zh-TW/core/service)；即時進出放 Channel；「寫庫成功後再推一把」放在路由或 Console 指令裡調 `ws.room`。

## 下一步

- [事件路由 Channel](/zh-TW/websocket/channel) —— 先寫一個能回 `pong` 的事件
- [入站 payload](/zh-TW/websocket/payload) / [出站 emit](/zh-TW/websocket/emit)
- [傳輸層](/zh-TW/websocket/transport) —— 要不要上 Socket.IO
- [多機 Hub](/zh-TW/websocket/hub) —— 多副本或 Console 跨程序推送
