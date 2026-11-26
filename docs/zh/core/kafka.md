---
outline: deep
---

# Kafka

这一页带你把「下单成功 → 发出去 → 账单进程收下来处理」整条链跑通。主题用一份契约两边共用；Web 进程只负责 `produce`，Console 指令里再 `consume`——首次发消息才连生产者，点开消费才进消费组，关停时框架会断开。

先装包。下面还要用到项目里已有的 [日志](/zh/core/logger) 和 [服务层](/zh/core/service)（`combineServices`）。

```bash
pnpm add @aomex/kafka
```

本地先起一个 Kafka（例如 `127.0.0.1:9092`）。生产环境一般预先建好主题；本地想省事可在服务配置里打开 `allowAutoTopicCreation`。

## 先挂上 Kafka 服务

用 `createKafkaService` 生成一个零参类，交给 `combineServices`。必填 broker 地址、`clientId`（会出现在 broker 日志里，用来认应用），以及和 WebApp / ConsoleApp **同一份** `logger`（从 `@/services/logger.service` 导入，见 [日志](/zh/core/logger)）——消费时的 `ctx.logger` 就是它：

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
  // …其它服务
});
```

写成 `() => import(...)` 是懒加载：第一次 `await services.kafka` 才装进内存、跑 `onInit`。生产者要等到首次 `produce` 才连 broker，`consume` 才加入消费组——只跑 Web、只发消息的进程不会进消费组，冷启动也更轻。

## 再定主题契约

服务有了，还差一份生产和消费共用的字段表——否则一边发了 `amount`、另一边当字符串读就会乱。每个主题一个文件，放在 `src/topics/`，文件名以 `.topic.ts` 结尾：

```typescript
// src/topics/order-created.topic.ts
import { rule } from '@aomex/common';
import { defineKafkaTopic } from '@aomex/kafka';

export const orderCreatedTopic = defineKafkaTopic('order.created', { // [!code focus:4]
  orderId: rule.string(),
  amount: rule.number(),
});
```

主题名只含字母、数字、`.`、`_`、`-`，最长 249 字符，不能是 `.` / `..`。消息体默认按 JSON 走，规则里不要塞 `Date`、`bigint`、`Buffer` 这类还原不回来的类型——类型上会直接拦住。不要 `new KafkaTopic`，一律用 `defineKafkaTopic`。

## 在接口里发出去

下单成功后调用 `services.kafka.produce`。`value` 必须对得上主题规则，写错字段 TypeScript 会报；这时 `ctx.body` 已经过 body 校验，可以直接塞进去：

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

`partitionKey` 可选：相同键进同一分区，同订单的消息就能保序。要跟业务 JSON 分开的追踪信息放 `headers`（字符串键值），消费侧从 `ctx.meta.headers` 读取。

一次要发多条时用 `produceMany`（按主题分组提交）；空数组会直接返回。`produce` / `produceMany` 返回 broker 回执；`acks` 配成 `0` 时回执数组为空。

先起 Web，打一枪 `POST /orders`——这一步只验证「能发出去」。还没有消费者时，消息会停在主题里等你下一步。

## 登记怎么处理

消费写法对齐路由：先 `new KafkaConsumer({ groupId })`，再 `on(主题, { action })`。建议放在 `src/consumers/`，主题从上面的 `.topic.ts` 引入：

```typescript
// src/consumers/order-created.consumer.ts
import { KafkaConsumer } from '@aomex/kafka';
import { orderCreatedTopic } from '@/topics/order-created.topic';

export const consumer = new KafkaConsumer({ groupId: 'billing' }); // [!code focus:9]
consumer.on(orderCreatedTopic, {
  action: async (ctx) => {
    // ctx.value.orderId / amount 已是校验后的类型
    ctx.logger.info(`入账 ${ctx.value.orderId} ${ctx.value.amount}`);
  },
});
```

`groupId` 相同的消费者共同分摊分区。`action` 里的 `ctx.value` 已经按主题规则校验过；`ctx.logger` 就是你传给 `createKafkaService` 的那份。

`ctx.meta` 汇总 Kafka 这条消息的位置和元数据：`topic` 是主题名，`partitionId` 是分区编号，`offset` 是该分区内的消息位置（字符串，避免大整数精度丢失），`timestamp` 是 broker 提供的毫秒时间戳（字符串），`partitionKey` 是发送时使用的分区键（未设置时为 `null`），`headers` 是消息头（没有消息头时为空对象；同名消息头有多个值时只保留最后一个）。例如，要读取发送方附带的 `traceId`，可访问 `ctx.meta.headers['trace-id']`。

`ctx.recordKey` 则是 `ctx` 顶层的稳定记录标识，格式为 `groupId:topic:partitionId:offset`，例如 `billing:order.created:0:9`。其中 groupId、topic 和 offset 会进行 URL 编码，因此包含冒号等特殊字符时仍能正确区分各段。同一消费组重试处理同一条记录时，这个值保持不变，可用于日志关联或幂等去重；它不是业务单号，也不是 `partitionKey`，不同消费组会得到不同的 `recordKey`。

同一个实例里主题名不能重复。某个环境暂时不收这个主题时，给 `on` 加上 `disabled: true` 即可。

::: warning
`consume` 会一直跑到进程关停或处理失败，**不要**写进 HTTP 的 action——请求会挂死。下一步把它放进 Console 指令。
:::

## 用 Console 指令跑起来

建一条指令，把消费者目录交给 `consume`。目录里导出的 `KafkaConsumer` 会自动合并；同一次 `consume` 里的实例必须是同一个 `groupId`：

```typescript
// src/commanders/kafka.commander.ts
import { Commander } from '@aomex/console';
import { services } from '@/services';

export const commander = new Commander({ prefix: 'kafka:' });

commander.create('consume', { // [!code focus:6]
  docs: { summary: '启动 Kafka 消费组' },
  action: async () => {
    await services.kafka.consume('./src/consumers');
  },
});
```

确认 ConsoleApp 的 mount 里已有 `commanders('./src/commanders')`（脚手架一般已挂好），然后：

```bash
aomex kafka:consume
```

另开终端再 `POST /orders`，你会看到账单进程打出「入账 …」。处理函数正常返回后才提交下一条偏移量（至少一次）；`action` 抛错则不提交，`consume` 的 Promise 会拒绝——这时应按失败退出，修好再启，避免悄悄丢位移。

没有已提交位点时，默认从**最新**开始读（只收启动之后的新消息）。要补历史再改成：

```typescript
await services.kafka.consume('./src/consumers', { fromBeginning: true });
```

已有提交位点时仍从提交处继续，不受 `fromBeginning` 影响。也可以传入单个实例或实例数组，不必一定走目录扫描。

到这里，最小可用链路已经通了。下面是你真用到时再补的几块。

## 多主题共用一段逻辑

多条主题都要先打追踪、再进业务时，用 `middleware.kafka`（或 `middleware.mixin`）。`createKafkaService`、`KafkaConsumer`、单主题 `on` 的 `mount` **只认这两种**，不能塞 Web / Console 中间件。执行顺序：服务级 → 消费组级 → 主题级。

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

记得 `await next()`，否则 `action` 跑不到。同一实例不能并行开两路 `consume`；要第二个消费组就再 `createKafkaService` 一次。更多中间件写法见 [中间件](/zh/core/middleware)。

## 连生产集群

本地明文 broker 够用就不用改。上 TLS / 账号密码时，在服务工厂里补上即可（证书、私钥只接受 PEM 字符串、Buffer 或它们的数组；`aws` 机制当前不支持）：

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

其它常改项按需加在同一处：`allowAutoTopicCreation`（本地省事）、`sessionTimeout` / `heartbeatInterval`（`DurationInput`，如 `'30s'`；心跳须小于会话超时）、`maxMessageBytes`（默认 1 MiB，超限发送和消费都会拒）。幂等生产者默认开启，此时 `acks` 必须是 `-1`；若你改成 `acks: 1` 或 `0`，需同时关掉 `idempotent`。

消息默认 JSON。整站要换编码时再传一对 `encode` / `decode`，`encode` 的结果仍受 `maxMessageBytes` 限制。

## 下一步

- 服务怎么挂进 App：[服务层](/zh/core/service)
- 消费指令怎么写：[指令路由](/zh/console/commander)
- 全站 Logger：[日志](/zh/core/logger)
- 主题字段校验：[验证器](/zh/validators/)
