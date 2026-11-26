---
outline: deep
---

# Kafka

このページでは、「注文確定 → メッセージ送信 → 請求処理で受信して処理」という一連の流れを動かします。Producer と Consumer は同じトピック契約を共有します。Web プロセスは `produce` のみを行い、Console コマンドから `consume` を実行します。Producer は最初の送信時に接続し、Consumer は consume を開始したときに初めてコンシューマーグループへ参加します。終了時の切断は自動で行われます。

パッケージをインストールします。プロジェクトに [Logger](/ja/core/logger) と [Services](/ja/core/service)（`combineServices`）も必要です。

```bash
pnpm add @aomex/kafka
```

ローカルで Kafka を起動しておきます（例：`127.0.0.1:9092`）。本番環境では通常、トピックを事前に作成します。ローカルではサービスのオプションで `allowAutoTopicCreation` を有効にできます。

## まず Kafka サービスを登録する

`createKafkaService` は、`combineServices` に渡す引数なしのクラスを返します。broker のアドレス、アプリケーションを識別するため broker のログに表示される `clientId`、そして WebApp / ConsoleApp と**同じ** `logger` インスタンスが必要です（`@/services/logger.service` からインポートします。[ロギング](/ja/core/logger)を参照）。Consumer の `ctx.logger` もこのインスタンスです。

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
  // …その他のサービス
});
```

`() => import(...)` と書くと遅延読み込みになります。`await services.kafka` を最初に実行したときにモジュールが読み込まれ、`onInit` が実行されます。Producer は最初の `produce` まで broker に接続せず、Consumer も `consume` の開始時に初めてグループへ参加します。Web だけを実行してメッセージを送るプロセスはグループに参加しないため、起動も軽くなります。

## 次にトピック契約を定義する

サービスを登録したら、Producer と Consumer が共有するフィールド定義を追加します。これがないと、片方が `amount` を数値で送信し、もう片方が文字列として読み取るといった不一致が起こります。トピックごとに `src/topics/` にファイルを作り、`.topic.ts` で終わる名前を付けます。

```typescript
// src/topics/order-created.topic.ts
import { rule } from '@aomex/common';
import { defineKafkaTopic } from '@aomex/kafka';

export const orderCreatedTopic = defineKafkaTopic('order.created', { // [!code focus:4]
  orderId: rule.string(),
  amount: rule.number(),
});
```

トピック名に使えるのは英字、数字、`.`、`_`、`-` のみで、長さは最大249文字です。`.` と `..` は使えません。メッセージは既定で JSON として扱われるため、ルールに `Date`、`bigint`、`Buffer` など JSON で元に戻せない型を含めないでください。型チェックでも拒否されます。`new KafkaTopic` は使わず、必ず `defineKafkaTopic` を使います。

## ルートからメッセージを送信する

注文が確定したら `services.kafka.produce` を呼び出します。`value` はトピックのルールに一致させる必要があり、フィールドの誤りは TypeScript が検出します。この時点では `ctx.body` の検証が済んでいるので、そのまま渡せます。

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

`partitionKey` は省略できます。同じキーは同じパーティションに送られるため、同じ注文のメッセージ順を保てます。業務データの JSON と分けてトレース情報を渡すには `headers` を使います（キーと値は文字列）。Consumer 側では `ctx.meta.headers` から読み取れます。

複数のメッセージをまとめて送るには `produceMany` を使います（トピックごとにまとめて送信します）。空の配列を渡すとすぐに戻ります。どちらの API も broker の送信結果を返しますが、`acks: 0` の場合、結果の配列は空です。

Web を起動して `POST /orders` を一度実行します。この段階では送信できることだけを確認します。まだ Consumer がない場合、メッセージは次の手順までトピックに保持されます。

## メッセージの処理方法を登録する

Consumer の書き方はルートと同様です。`new KafkaConsumer({ groupId })` を作り、`on(トピック, { action })` で処理を登録します。`src/consumers/` に配置し、トピックは先ほどの `.topic.ts` ファイルからインポートすることをおすすめします。

```typescript
// src/consumers/order-created.consumer.ts
import { KafkaConsumer } from '@aomex/kafka';
import { orderCreatedTopic } from '@/topics/order-created.topic';

export const consumer = new KafkaConsumer({ groupId: 'billing' }); // [!code focus:9]
consumer.on(orderCreatedTopic, {
  action: async (ctx) => {
    // ctx.value.orderId / amount は検証済みの型です
    ctx.logger.info(`請求処理 ${ctx.value.orderId} ${ctx.value.amount}`);
  },
});
```

同じ `groupId` を持つ Consumer はパーティションを分担します。`ctx.value` はすでにトピックのルールに従って検証されています。`ctx.logger` は `createKafkaService` に渡したインスタンスです。

`ctx.meta` には、そのメッセージの Kafka 上の位置とメタデータがまとまっています。`topic` はトピック名、`partitionId` はパーティション番号、`offset` はパーティション内のメッセージ位置（大きな整数の精度を保つため文字列）、`timestamp` は broker が付けたミリ秒単位のタイムスタンプ（文字列）、`partitionKey` は送信時のキー（未設定なら `null`）、`headers` はメッセージヘッダーです（ヘッダーがなければ空オブジェクト、同じ名前に複数の値があれば最後の値のみ保持）。たとえば、送信側が付けた trace ID は `ctx.meta.headers['trace-id']` で取得できます。

`ctx.recordKey` は `ctx` のトップレベルにある安定したレコード識別子で、形式は `groupId:topic:partitionId:offset` です（例：`billing:order.created:0:9`）。groupId、topic、offset は URL エンコードされるため、値にコロンなどが含まれても各部分を区別できます。同じ Consumer グループで同じレコードを再処理する場合も値は変わらず、ログの照合や冪等な重複排除に利用できます。業務上の注文 ID や `partitionKey` とは異なり、Consumer グループが異なると `recordKey` も異なります。

同じインスタンスでトピック名を重複させることはできません。特定の環境でトピックを一時的に処理しない場合は、`on` に `disabled: true` を設定します。

::: warning
`consume` は、プロセスの終了または処理失敗まで実行され続けます。**HTTP action から呼び出さないでください**。リクエストが返らなくなります。次の手順で Console コマンドから実行します。
:::

## Console コマンドから実行する

コマンドを追加し、Consumer のディレクトリを `consume` に渡します。そのディレクトリからエクスポートされた `KafkaConsumer` インスタンスはまとめて処理されます。1回の `consume` に渡すインスタンスは、すべて同じ `groupId` を使う必要があります。

```typescript
// src/commanders/kafka.commander.ts
import { Commander } from '@aomex/console';
import { services } from '@/services';

export const commander = new Commander({ prefix: 'kafka:' });

commander.create('consume', { // [!code focus:6]
  docs: { summary: 'Kafka コンシューマーグループを起動' },
  action: async () => {
    await services.kafka.consume('./src/consumers');
  },
});
```

ConsoleApp の mount に `commanders('./src/commanders')` が設定されていることを確認します（通常、スキャフォールドでは設定済みです）。その後、次のコマンドを実行します。

```bash
aomex kafka:consume
```

別のターミナルからもう一度 `POST /orders` を実行すると、請求処理のログに注文の処理内容が表示されます。ハンドラーが正常に戻った後で、次のオフセットがコミットされます（少なくとも1回の配信）。`action` が例外を投げるとコミットされず、`consume` の Promise は reject されます。処理を失敗として終了し、問題を修正して再起動してください。そうすれば、処理を飛ばしたままにすることを防げます。

コミット済みのオフセットがない場合、既定では**最新**の位置から読み込みます（起動後に届いたメッセージのみ）。過去のメッセージも読み込むには、次のようにします。

```typescript
await services.kafka.consume('./src/consumers', { fromBeginning: true });
```

すでにオフセットがコミットされている場合は、`fromBeginning` の設定にかかわらずその位置から再開します。ディレクトリの代わりに、Consumer インスタンスを1つ、または配列で渡すこともできます。

ここまでで、最小限の一連の処理が動作します。以下は必要になったときに追加してください。

## 複数のトピックでロジックを共有する

複数のトピックで業務処理の前にトレース処理を行う場合は、`middleware.kafka`（または `middleware.mixin`）を使います。`createKafkaService`、`KafkaConsumer`、トピックごとの `on` にある `mount` が受け付けるのは、この2種類だけです。Web や Console の middleware は渡せません。実行順はサービス → Consumer グループ → トピックです。

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

`await next()` を忘れると `action` が実行されません。同じインスタンスで `consume` を並行実行することはできません。2つ目のグループが必要な場合は、もう一度 `createKafkaService` を使って別のサービスを作成します。詳しくは [Middleware](/ja/core/middleware) を参照してください。

## 本番クラスターに接続する

ローカルの平文 broker なら追加設定は不要です。TLS や認証情報が必要な場合は、ファクトリーに設定を追加します（証明書と秘密鍵は PEM 文字列、Buffer、またはそれらの配列を指定します。`aws` SASL はサポートされていません）。

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

必要に応じて、ほかの設定も同じ場所に追加できます。`allowAutoTopicCreation` はローカルで便利です。`sessionTimeout` / `heartbeatInterval` には `'30s'` のような `DurationInput` を指定でき、heartbeat は session timeout より短くする必要があります。`maxMessageBytes` の既定値は 1 MiB で、上限を超えるメッセージは送信時と受信時の両方で拒否されます。冪等 Producer は既定で有効で、その場合 `acks: -1` が必要です。`acks` を `1` または `0` に変更する場合は、`idempotent` も無効にしてください。

メッセージは既定で JSON です。アプリケーション全体で形式を変更するには `encode` / `decode` を指定します。`encode` の出力も `maxMessageBytes` の制限対象です。

## 次のステップ

- サービスを App に登録する：[Services](/ja/core/service)
- Console コマンド：[Commander](/ja/console/commander)
- 共有 Logger：[ロギング](/ja/core/logger)
- トピックのフィールド検証：[Validators](/ja/validators/)
