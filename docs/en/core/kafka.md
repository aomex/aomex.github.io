---
outline: deep
---

# Kafka

This page walks you through a full loop: order placed → publish → a billing process consumes and handles it. Producers and consumers share one topic contract. The Web process only `produce`s; a Console command `consume`s. The producer connects on first send; the consumer joins a group only when you start consuming; shutdown disconnects for you.

Install the package. You’ll also need the project’s [Logger](/en/core/logger) and [Services](/en/core/service) (`combineServices`).

```bash
pnpm add @aomex/kafka
```

Have Kafka listening locally (for example `127.0.0.1:9092`). Production usually pre-creates topics; locally you can turn on `allowAutoTopicCreation` in the service options.

## Register the Kafka service first

`createKafkaService` returns a zero-arg class for `combineServices`. You need brokers, a `clientId` (shows up in broker logs so you can tell apps apart), and the **same** `logger` instance as WebApp / ConsoleApp (import from `@/services/logger.service`—see [Logging](/en/core/logger)). Consumer `ctx.logger` is that instance:

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
  // …other services
});
```

Use `() => import(...)` for lazy loading: the module loads and `onInit` runs only on the first `await services.kafka`. The producer connects on the first `produce`; the consumer joins a group only on `consume`—a Web-only, produce-only process never joins a group, and cold start stays lighter.

## Then declare the topic contract

With the service in place, add the field list that producers and consumers share—otherwise one side sends `amount` as a number and the other reads a string. One file per topic under `src/topics/`, ending in `.topic.ts`:

```typescript
// src/topics/order-created.topic.ts
import { rule } from '@aomex/common';
import { defineKafkaTopic } from '@aomex/kafka';

export const orderCreatedTopic = defineKafkaTopic('order.created', { // [!code focus:4]
  orderId: rule.string(),
  amount: rule.number(),
});
```

Topic names may only use letters, digits, `.`, `_`, `-`, at most 249 characters, and not `.` / `..`. Payloads default to JSON—don’t put `Date`, `bigint`, or `Buffer` in the rule; the type system rejects them. Never `new KafkaTopic`; always `defineKafkaTopic`.

## Produce from a route

After a successful order, call `services.kafka.produce`. `value` must match the topic rule; TypeScript catches bad fields. By then `ctx.body` is already validated, so you can pass it through:

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

`partitionKey` is optional: same key → same partition, so one order’s messages stay ordered. Put tracing metadata outside the business JSON in `headers` (string keys and values); the consumer reads it from `ctx.meta.headers`.

Use `produceMany` for a batch (grouped by topic); an empty array returns immediately. Both APIs return broker receipts; with `acks: 0` the array is empty.

Start Web and `POST /orders` once—this only checks that publish works. Without a consumer yet, messages wait on the topic for the next step.

## Register how to handle them

Same shape as routing: `new KafkaConsumer({ groupId })`, then `on(topic, { action })`. Prefer `src/consumers/` and import topics from the `.topic.ts` files above:

```typescript
// src/consumers/order-created.consumer.ts
import { KafkaConsumer } from '@aomex/kafka';
import { orderCreatedTopic } from '@/topics/order-created.topic';

export const consumer = new KafkaConsumer({ groupId: 'billing' }); // [!code focus:9]
consumer.on(orderCreatedTopic, {
  action: async (ctx) => {
    // ctx.value.orderId / amount are validated types
    ctx.logger.info(`book ${ctx.value.orderId} ${ctx.value.amount}`);
  },
});
```

Consumers with the same `groupId` share partitions. `ctx.value` is already validated; `ctx.logger` is the instance you passed to `createKafkaService`.

`ctx.meta` collects the Kafka position and metadata for this message: `topic` is its topic name, `partitionId` its partition number, `offset` its position within that partition (a string, to avoid losing precision for large integers), `timestamp` the broker-provided timestamp in milliseconds (a string), `partitionKey` the key used when producing the message (`null` if none was set), and `headers` the message headers (an empty object when absent; if a header has multiple values, only the last is kept). For example, read a producer-supplied trace ID with `ctx.meta.headers['trace-id']`.

`ctx.recordKey` is a stable identifier on the top-level `ctx`, formatted as `groupId:topic:partitionId:offset` (for example, `billing:order.created:0:9`). The group ID, topic, and offset are URL-encoded, so separators inside those values do not make the segments ambiguous. Retrying the same record in the same consumer group yields the same key, making it useful for log correlation or idempotent deduplication. It is not a business order ID or a `partitionKey`; a different consumer group gets a different `recordKey`.

Topic names can’t repeat on one instance. To skip a topic in some environments, set `disabled: true` on `on`.

::: warning
`consume` runs until shutdown or failure—**do not** call it from an HTTP action; the request will hang. Put it in a Console command next.
:::

## Run it from a Console command

Add a command and hand the consumers directory to `consume`. Exported `KafkaConsumer` instances in that directory are merged; they must share one `groupId` for a single `consume` call:

```typescript
// src/commanders/kafka.commander.ts
import { Commander } from '@aomex/console';
import { services } from '@/services';

export const commander = new Commander({ prefix: 'kafka:' });

commander.create('consume', { // [!code focus:6]
  docs: { summary: 'Start Kafka consumer group' },
  action: async () => {
    await services.kafka.consume('./src/consumers');
  },
});
```

Make sure ConsoleApp mount already has `commanders('./src/commanders')` (scaffolds usually do), then:

```bash
aomex kafka:consume
```

In another terminal `POST /orders` again—you should see the billing process log the booking line. The next offset commits only after the handler returns (at-least-once). If `action` throws, nothing is committed and the `consume` Promise rejects—exit as a failure, fix, and restart so you don’t silently skip ahead.

With no committed offset, the default is **latest** (only messages after start). To backfill:

```typescript
await services.kafka.consume('./src/consumers', { fromBeginning: true });
```

Existing commits still resume from the committed position. You can also pass one instance or an array instead of a directory.

That’s the minimum working path. The rest is only when you need it.

## Shared logic across topics

When several topics need tracing before business code, use `middleware.kafka` (or `middleware.mixin`). `mount` on `createKafkaService`, `KafkaConsumer`, and per-topic `on` accepts **only** those two—not Web or Console middleware. Order: service → consumer group → topic.

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

Always `await next()` or `action` never runs. One instance can’t `consume` in parallel; create another service for a second group. More on middleware: [Middleware](/en/core/middleware).

## Connect to production

Plain local brokers need no extra options. For TLS / credentials, add them on the factory (certs and keys: PEM string, Buffer, or arrays; `aws` SASL is unsupported):

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

Other knobs live in the same place when you need them: `allowAutoTopicCreation` (handy locally), `sessionTimeout` / `heartbeatInterval` (`DurationInput` like `'30s'`; heartbeat must be less than session timeout), `maxMessageBytes` (default 1 MiB; oversize is rejected on send and consume). Idempotent producers are on by default, which requires `acks: -1`; if you set `acks` to `1` or `0`, turn `idempotent` off too.

Payloads default to JSON. Swap formats site-wide with `encode` / `decode`; `encode` output still counts toward `maxMessageBytes`.

## Next steps

- Wiring services into the app: [Services](/en/core/service)
- Console commands: [Commander](/en/console/commander)
- Shared Logger: [Logging](/en/core/logger)
- Topic field validation: [Validators](/en/validators/)
