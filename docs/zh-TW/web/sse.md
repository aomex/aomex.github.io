---
outline: deep
---

# 服務端推送 SSE

做一條「服務端持續往下推、瀏覽器用 EventSource 聽」的 GET 介面：在 action 裡調 ctx.sse()，用 stream 或 send 往外扔事件。適合通知、進度條、行情重新整理；雙向雜亂幀再考慮 WebSocket。

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

優先用 stream：客戶端斷開時 signal 會 abort，迭代結束會自動收尾，少寫一堆 close / 清定時器。

`ctx.sse()` 與 `ctx.response.sse()` 等價；須在**還沒寫出響應頭**時呼叫，否則直接拋錯。SSE 佔住整條響應，別在同一路由末尾再 ctx.send JSON。開啟後狀態碼 200、Content-Type: text/event-stream。emit / send 的 data 傳物件時會 JSON 序列化；lastEventId 來自請求頭，首次連線多半是 undefined。

## heartbeat 與 retry

瀏覽器長連線容易被反代當成空閒掐斷。**heartbeat** 週期性推註釋行保活；**retry** 建議客戶端斷線後隔多少毫秒重連（寫在連線建立時的 SSE 選項裡）。本地短測可把 heartbeat 關掉；經 Nginx、CDN 的生產流要兩項都對一下。

長連線經 Nginx、CDN 時保活；本地短測可關掉心跳：

```typescript
const sse = ctx.sse({
  heartbeat: 10_000,
  retry: 3_000,
});
```

| 選項 | 預設 / 習慣 | 什麼時候用 |
| --- | --- | --- |
| `heartbeat` | 常見約 15s | 經 Nginx、CDN 的長連線保活；本地短測可 `heartbeat: false` |
| `retry` | 不設 | 希望瀏覽器斷線後按毫秒間隔重連（通知流常設 `3000`） |

## 單條事件欄位

每次 `send` / `emit` 可帶 event 名、id、可選的單條 retry，以及 data 載荷。物件型 data 會自動 JSON 序列化；設 **id** 時瀏覽器重連會帶 `Last-Event-ID`，便於續傳。

| 欄位 | 什麼時候用 |
| --- | --- |
| `data` | 載荷；物件自動 JSON |
| `event` | 多種事件共存（`job` / `progress` / `ready`），前端按名監聽 |
| `id` | 斷線續傳；重連帶 `Last-Event-ID` |
| `retry` | 單條事件裡臨時改重連間隔 |

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

## stream、續傳與收尾

`stream` 把「邊讀上游、邊 emit」包成一段生命週期：客戶端斷開時 **signal** abort，迭代結束會收尾，省得手寫定時器和 close。`lastEventId` 來自請求頭，用它從某條事件之後續推；`onClose` 裡釋放訂閱、記審計。

```typescript
await sse.stream(async (emit, signal) => {
  // emit 等同 sse.send；signal 断开即 abort
});
```

| 成員 | 常見做法是怎麼用 |
| --- | --- |
| `lastEventId` | 從該 id 之後繼續推 |
| `signal` | 傳給 Redis 訂閱、佇列 watch，客戶端走了上游也停 |
| `onClose(fn)` | 釋放訂閱、記審計 |
| `close()` | 任務結束主動關流；`stream` 結束會自動調 |

```typescript
const after = sse.lastEventId; // [!code highlight]
sse.onClose(() => {
  subscription.unsubscribe();
});
sse.close();
```

連線已關或不可寫時，send 會靜默忽略——別當成「一定送達」。要斷線續傳就給事件設穩定 id，否則 lastEventId 對不上、重連會從頭髮。

::: warning
長連線經 Nginx 等反代時，除框架的 X-Accel-Buffering: no 外，心跳和反代緩衝超時仍要對一下配置，否則容易被當空閒掐斷。
:::

## 與 response()、OpenAPI

OpenAPI 需要知道這條 GET 出口是 `text/event-stream`，所以在 mount 裡掛 `response({ contentType: 'text/event-stream', ... })`。這隻服務文件和型別，**不能替代** action 裡的 `ctx.sse()` 寫幀。

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

這隻幫文件和型別提示，**不能代替** `ctx.sse()` 的幀協議。壓縮中介軟體一般會跳過 text/event-stream，見 [Compress](/zh-TW/plugins/compress)。

EventSource 只能 GET，跨站帶 cookie 時要配好 [CORS](/zh-TW/plugins/cors)。

## 下一步

- [約束響應](/zh-TW/web/response)（流式出口的 contentType 宣告）
- [輸入輸出總覽](/zh-TW/web/)（和其它 Web 中介軟體一起掛載）
- [Compress](/zh-TW/plugins/compress)（別壓壞事件流）