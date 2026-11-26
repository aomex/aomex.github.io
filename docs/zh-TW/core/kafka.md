---
outline: deep
---

# Kafka

這一頁帶你把「下單成功 → 發出去 → 帳單程序收下來處理」整條鏈跑通。主題用一份契約兩邊共用；Web 程序只負責 `produce`，Console 指令裡再 `consume`——首次發訊息才連生產者，點開消費才進消費組，關停時框架會斷開。

先裝包。下面還要用到專案裡已有的 [日誌](/zh-TW/core/logger) 和 [服務層](/zh-TW/core/service)（`combineServices`）。

```bash
pnpm add @aomex/kafka
```

本地先起一個 Kafka（例如 `127.0.0.1:9092`）。生產環境一般預先建好主題；本地想省事可在服務配置裡開啟 `allowAutoTopicCreation`。

## 先掛上 Kafka 服務

用 `createKafkaService` 生成一個零參類，交給 `combineServices`。必填 broker 地址、`clientId`（會出現在 broker 日誌裡，用來認應用），以及和 WebApp / ConsoleApp **同一份** `logger`（從 `@/services/logger.service` 匯入，見 [日誌](/zh-TW/core/logger)）——消費時的 `ctx.logger` 就是它：

```typescript
// src/services/kafka.service.ts
import { createKafkaService } from '@aomex/kafka';
import { logger } from '@/services/logger.service'; // [!code highlight]

export default createKafkaService({ // [!code focus:5]
  brokers: ['127.0.0.1:9092'],
  clientId: 'shop',
  logger,
});
```

```typescript
// src/services/index.ts
import { combineServices } from '@aomex/common';

export const services = await combineServices({
  kafka: () => import('@/services/kafka.service.js'), // [!code highlight]
  // …其它服務
});
```

寫成 `() => import(...)` 是懶載入：第一次 `await services.kafka` 才裝進記憶體、跑 `onInit`。生產者要等到首次 `produce` 才連 broker，`consume` 才加入消費組——只跑 Web、只發訊息的程序不會進消費組，冷啟動也更輕。

## 再定主題契約

服務有了，還差一份生產和消費共用的欄位表——否則一邊發了 `amount`、另一邊當字串讀就會亂。每個主題一個檔案，放在 `src/topics/`，檔名以 `.topic.ts` 結尾：

```typescript
// src/topics/order-created.topic.ts
import { rule } from '@aomex/common';
import { defineKafkaTopic } from '@aomex/kafka';

export const orderCreatedTopic = defineKafkaTopic('order.created', { // [!code focus:4]
  orderId: rule.string(),
  amount: rule.number(),
});
```

主題名只含字母、數字、`.`、`_`、`-`，最長 249 字元，不能是 `.` / `..`。訊息體預設按 JSON 走，規則裡不要塞 `Date`、`bigint`、`Buffer` 這類還原不回來的型別——型別上會直接攔住。不要 `new KafkaTopic`，一律用 `defineKafkaTopic`。

## 在介面裡發出去

下單成功後呼叫 `services.kafka.produce`。`value` 必須對得上主題規則，寫錯欄位 TypeScript 會報；這時 `ctx.body` 已經過 body 校驗，可以直接塞進去：

```typescript
// src/routers/order.router.ts
import { Router, body } from '@aomex/web';
import { rule } from '@aomex/common';
import { services } from '@/services';
import { orderCreatedTopic } from '@/topics/order-created.topic';

export const router = new Router();

router.post('/orders', {
  mount: [
    body({
      orderId: rule.string(),
      amount: rule.number(),
    }),
  ],
  action: async (ctx) => {
    const { orderId, amount } = ctx.body; // [!code focus:9]
    await services.kafka.produce({
      topic: orderCreatedTopic,
      value: {
        orderId,
        amount,
      },
      partitionKey: orderId,
    });
    ctx.send({ ok: true });
  },
});
```

`partitionKey` 可選：相同鍵進同一分區，同訂單的訊息就能保序。要跟業務 JSON 分開的追蹤資訊放 `headers`（字串鍵值），消費側從 `ctx.meta.headers` 讀取。

一次要發多條時用 `produceMany`（按主題分組提交）；空陣列會直接返回。`produce` / `produceMany` 返回 broker 回執；`acks` 配成 `0` 時回執陣列為空。

先起 Web，打一槍 `POST /orders`——這一步只驗證「能發出去」。還沒有消費者時，訊息會停在主題裡等你下一步。

## 登記怎麼處理

消費寫法對齊路由：先 `new KafkaConsumer({ groupId })`，再 `on(主題, { action })`。建議放在 `src/consumers/`，主題從上面的 `.topic.ts` 引入：

```typescript
// src/consumers/order-created.consumer.ts
import { KafkaConsumer } from '@aomex/kafka';
import { orderCreatedTopic } from '@/topics/order-created.topic';

export const consumer = new KafkaConsumer({ groupId: 'billing' }); // [!code focus:9]
consumer.on(orderCreatedTopic, {
  action: async (ctx) => {
    // ctx.value.orderId / amount 已是校驗後的型別
    ctx.logger.info(`入帳 ${ctx.value.orderId} ${ctx.value.amount}`);
  },
});
```

`groupId` 相同的消費者共同分攤分區。`action` 裡的 `ctx.value` 已經按主題規則校驗過；`ctx.logger` 就是你傳給 `createKafkaService` 的那份。

`ctx.meta` 彙整 Kafka 這則訊息的位置與中繼資料：`topic` 是主題名稱，`partitionId` 是分區編號，`offset` 是該分區內的訊息位置（字串，可避免大整數精度遺失），`timestamp` 是 broker 提供的毫秒時間戳（字串），`partitionKey` 是傳送時使用的分區鍵（未設定時為 `null`），`headers` 是訊息標頭（沒有標頭時為空物件；同名標頭有多個值時只保留最後一個）。例如，要讀取傳送方附帶的 `traceId`，可透過 `ctx.meta.headers['trace-id']` 存取。

`ctx.recordKey` 則是 `ctx` 頂層的穩定記錄標識，格式為 `groupId:topic:partitionId:offset`，例如 `billing:order.created:0:9`。其中 groupId、topic 和 offset 會經過 URL 編碼，因此包含冒號等特殊字元時仍能正確區分各段。同一消費組重試處理同一筆記錄時，此值保持不變，可用於日誌關聯或冪等去重；它不是業務單號，也不是 `partitionKey`，不同消費組會得到不同的 `recordKey`。

同一個實例裡主題名不能重複。某個環境暫時不收這個主題時，給 `on` 加上 `disabled: true` 即可。

::: warning
`consume` 會一直跑到程序關停或處理失敗，**不要**寫進 HTTP 的 action——請求會掛死。下一步把它放進 Console 指令。
:::

## 用 Console 指令跑起來

建一條指令，把消費者目錄交給 `consume`。目錄裡匯出的 `KafkaConsumer` 會自動合併；同一次 `consume` 裡的實例必須是同一個 `groupId`：

```typescript
// src/commanders/kafka.commander.ts
import { Commander } from '@aomex/console';
import { services } from '@/services';

export const commander = new Commander({ prefix: 'kafka:' });

commander.create('consume', { // [!code focus:6]
  docs: { summary: '啟動 Kafka 消費組' },
  action: async () => {
    await services.kafka.consume('./src/consumers');
  },
});
```

確認 ConsoleApp 的 mount 裡已有 `commanders('./src/commanders')`（腳手架一般已掛好），然後：

```bash
aomex kafka:consume
```

另開終端再 `POST /orders`，你會看到帳單程序打出「入帳 …」。處理函式正常返回後才提交下一條偏移量（至少一次）；`action` 拋錯則不提交，`consume` 的 Promise 會拒絕——這時應按失敗退出，修好再啟，避免悄悄丟位移。

沒有已提交位點時，預設從**最新**開始讀（只收啟動之後的新訊息）。要補歷史再改成：

```typescript
await services.kafka.consume('./src/consumers', { fromBeginning: true });
```

已有提交位點時仍從提交處繼續，不受 `fromBeginning` 影響。也可以傳入單個實例或實例陣列，不必一定走目錄掃描。

到這裡，最小可用鏈路已經通了。下面是你真用到時再補的幾塊。

## 多主題共用一段邏輯

多條主題都要先打追蹤、再進業務時，用 `middleware.kafka`（或 `middleware.mixin`）。`createKafkaService`、`KafkaConsumer`、單主題 `on` 的 `mount` **只認這兩種**，不能塞 Web / Console 中介軟體。執行順序：服務級 → 消費組級 → 主題級。

```typescript
import { middleware } from '@aomex/common';
import { KafkaConsumer } from '@aomex/kafka';
import { orderCreatedTopic } from '@/topics/order-created.topic';

const withTrace = middleware.kafka<{ traceId: string }>(async (ctx, next) => { // [!code focus:4]
  ctx.traceId = ctx.meta.headers['x-trace-id'] ?? crypto.randomUUID();
  await next();
});

export const consumer = new KafkaConsumer({
  groupId: 'billing',
  mount: [withTrace],
});

consumer.on(orderCreatedTopic, {
  action: async (ctx) => {
    ctx.logger.info(`${ctx.traceId} ${ctx.value.orderId}`);
  },
});
```

記得 `await next()`，否則 `action` 跑不到。同一實例不能並行開兩路 `consume`；要第二個消費組就再 `createKafkaService` 一次。更多中介軟體寫法見 [中介軟體](/zh-TW/core/middleware)。

## 連生產叢集

本地明文 broker 夠用就不用改。上 TLS / 賬號密碼時，在服務工廠裡補上即可（證書、私鑰只接受 PEM 字串、Buffer 或它們的陣列；`aws` 機制當前不支援）：

```typescript
import { logger } from '@/services/logger.service';

export default createKafkaService({
  brokers: ['kafka.example.com:9093'],
  clientId: 'shop',
  logger,
  ssl: true, // [!code highlight]
  sasl: { // [!code focus:4]
    mechanism: 'scram-sha-512',
    username: process.env['KAFKA_USER']!,
    password: process.env['KAFKA_PASSWORD']!,
  },
});
```

其它常改項按需加在同一處：`allowAutoTopicCreation`（本地省事）、`sessionTimeout` / `heartbeatInterval`（`DurationInput`，如 `'30s'`；心跳須小於會話超時）、`maxMessageBytes`（預設 1 MiB，超限傳送和消費都會拒）。冪等生產者預設開啟，此時 `acks` 必須是 `-1`；若你改成 `acks: 1` 或 `0`，需同時關掉 `idempotent`。

訊息預設 JSON。整站要換編碼時再傳一對 `encode` / `decode`，`encode` 的結果仍受 `maxMessageBytes` 限制。

## 下一步

- 服務怎麼掛進 App：[服務層](/zh-TW/core/service)
- 消費指令怎麼寫：[指令路由](/zh-TW/console/commander)
- 全站 Logger：[日誌](/zh-TW/core/logger)
- 主題欄位校驗：[驗證器](/zh-TW/validators/)
