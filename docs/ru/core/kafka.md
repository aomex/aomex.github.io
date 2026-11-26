---
outline: deep
---

# Kafka

На этой странице вы пройдёте весь путь: создание заказа → отправка сообщения → получение и обработка в процессе выставления счетов. Продюсер и консьюмер используют общий контракт топика. Процесс Web только вызывает `produce`, а `consume` запускается командой Console. Продюсер подключается при первой отправке, консьюмер вступает в группу только при запуске consume, а при завершении работы соединение закрывается автоматически.

Установите пакет. Также понадобятся уже используемые в проекте [Logger](/ru/core/logger) и [Services](/ru/core/service) (`combineServices`).

```bash
pnpm add @aomex/kafka
```

Запустите Kafka локально, например на `127.0.0.1:9092`. В production топики обычно создают заранее; для локальной разработки можно включить `allowAutoTopicCreation` в параметрах сервиса.

## Сначала зарегистрируйте сервис Kafka

`createKafkaService` возвращает класс без аргументов, который передаётся в `combineServices`. Укажите адреса broker, `clientId` (он отображается в логах broker и помогает отличать приложения) и тот же экземпляр `logger`, что используется в WebApp / ConsoleApp (импортируйте его из `@/services/logger.service`; см. [Логирование](/ru/core/logger)). `ctx.logger` у консьюмера ссылается на этот экземпляр.

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
  // …другие сервисы
});
```

Запись `() => import(...)` включает отложенную загрузку: модуль загружается и запускает `onInit` только при первом `await services.kafka`. Продюсер подключается к broker при первом вызове `produce`, а консьюмер вступает в группу только при `consume`. Процесс, который запускает только Web и отправляет сообщения, не вступает в группу, поэтому стартует быстрее.

## Затем определите контракт топика

После регистрации сервиса добавьте описание полей, общее для продюсера и консьюмера. Иначе одна сторона может отправить `amount` как число, а другая прочитать его как строку. Создайте отдельный файл для каждого топика в `src/topics/` с именем, оканчивающимся на `.topic.ts`:

```typescript
// src/topics/order-created.topic.ts
import { rule } from '@aomex/common';
import { defineKafkaTopic } from '@aomex/kafka';

export const orderCreatedTopic = defineKafkaTopic('order.created', { // [!code focus:4]
  orderId: rule.string(),
  amount: rule.number(),
});
```

Имя топика может содержать только латинские буквы, цифры, `.`, `_` и `-`; максимальная длина — 249 символов. Имена `.` и `..` запрещены. По умолчанию сообщения передаются в формате JSON, поэтому не включайте в правило типы, которые нельзя восстановить из JSON, например `Date`, `bigint` или `Buffer`. Система типов не позволит это сделать. Не создавайте `new KafkaTopic` — всегда используйте `defineKafkaTopic`.

## Отправляйте сообщения из маршрута

После успешного оформления заказа вызовите `services.kafka.produce`. Значение `value` должно соответствовать правилу топика; TypeScript сообщит об ошибках в полях. К этому моменту `ctx.body` уже проверен, поэтому его данные можно передать напрямую:

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

`partitionKey` указывать необязательно: одинаковый ключ отправляет сообщения в одну партицию, сохраняя порядок сообщений одного заказа. Для передачи данных трассировки отдельно от бизнес-данных JSON используйте `headers` (ключи и значения — строки). Консьюмер получает их через `ctx.meta.headers`.

Для отправки пакета сообщений используйте `produceMany` (сообщения группируются по топикам); пустой массив обрабатывается сразу. Оба API возвращают подтверждения broker. При `acks: 0` массив подтверждений пуст.

Запустите Web и один раз отправьте `POST /orders` — так вы проверите только отправку. Пока консьюмера нет, сообщения останутся в топике до следующего шага.

## Зарегистрируйте обработчик сообщений

Консьюмер настраивается так же, как маршрут: создайте `new KafkaConsumer({ groupId })`, затем зарегистрируйте обработчик через `on(топик, { action })`. Рекомендуется хранить его в `src/consumers/`, а топик импортировать из созданного ранее файла `.topic.ts`:

```typescript
// src/consumers/order-created.consumer.ts
import { KafkaConsumer } from '@aomex/kafka';
import { orderCreatedTopic } from '@/topics/order-created.topic';

export const consumer = new KafkaConsumer({ groupId: 'billing' }); // [!code focus:9]
consumer.on(orderCreatedTopic, {
  action: async (ctx) => {
    // ctx.value.orderId / amount уже имеют проверенные типы
    ctx.logger.info(`Начисление ${ctx.value.orderId} ${ctx.value.amount}`);
  },
});
```

Консьюмеры с одинаковым `groupId` распределяют партиции между собой. `ctx.value` уже проверен по правилу топика, а `ctx.logger` — это экземпляр, переданный в `createKafkaService`.

`ctx.meta` содержит позицию и метаданные этого сообщения в Kafka: `topic` — имя топика, `partitionId` — номер партиции, `offset` — позиция сообщения в партиции (строка, чтобы не терять точность больших целых чисел), `timestamp` — временная метка broker в миллисекундах (строка), `partitionKey` — ключ, использованный при отправке (`null`, если он не задан), `headers` — заголовки сообщения (если их нет, это пустой объект; при нескольких значениях одного заголовка сохраняется последнее). Например, trace ID, добавленный отправителем, можно получить через `ctx.meta.headers['trace-id']`.

`ctx.recordKey` — стабильный идентификатор записи на верхнем уровне `ctx` в формате `groupId:topic:partitionId:offset` (например, `billing:order.created:0:9`). Group ID, topic и offset кодируются URL-кодированием, поэтому разделители внутри значений не смешиваются с разделителями между частями. При повторной обработке той же записи в той же группе значение не меняется; его можно использовать для сопоставления логов или идемпотентной дедупликации. Это не номер заказа и не `partitionKey`; у другой группы консьюмеров будет другой `recordKey`.

В одном экземпляре нельзя повторять имена топиков. Если в каком-либо окружении временно не нужно обрабатывать топик, укажите `disabled: true` в `on`.

::: warning
`consume` работает до завершения процесса или ошибки обработки. **Не вызывайте его в HTTP action** — запрос не завершится. Запустите его командой Console на следующем шаге.
:::

## Запустите обработчик командой Console

Добавьте команду и передайте `consume` каталог с консьюмерами. Экспортированные из этого каталога экземпляры `KafkaConsumer` объединяются; у всех экземпляров в одном вызове `consume` должен быть одинаковый `groupId`:

```typescript
// src/commanders/kafka.commander.ts
import { Commander } from '@aomex/console';
import { services } from '@/services';

export const commander = new Commander({ prefix: 'kafka:' });

commander.create('consume', { // [!code focus:6]
  docs: { summary: 'Запустить группу консьюмеров Kafka' },
  action: async () => {
    await services.kafka.consume('./src/consumers');
  },
});
```

Убедитесь, что в mount ConsoleApp уже добавлен `commanders('./src/commanders')` (обычно он есть в шаблоне), затем выполните:

```bash
aomex kafka:consume
```

В другом терминале снова отправьте `POST /orders` — в процессе выставления счетов появится запись об обработке заказа. Следующий offset фиксируется только после успешного возврата обработчика (доставка как минимум один раз). Если `action` выбросит ошибку, offset не фиксируется, а Promise от `consume` будет отклонён. Завершите процесс с ошибкой, исправьте проблему и запустите его снова, чтобы не пропустить сообщения незаметно.

Если сохранённого offset нет, по умолчанию чтение начинается с **последних** сообщений (поступивших после запуска). Чтобы прочитать историю, измените вызов:

```typescript
await services.kafka.consume('./src/consumers', { fromBeginning: true });
```

При наличии сохранённого offset чтение продолжится с него независимо от `fromBeginning`. Вместо каталога можно передать один экземпляр или массив экземпляров.

Минимальный рабочий процесс готов. Остальные настройки добавляйте, когда они понадобятся.

## Общая логика для нескольких топиков

Если перед бизнес-обработкой для нескольких топиков нужно выполнить трассировку, используйте `middleware.kafka` (или `middleware.mixin`). Параметр `mount` у `createKafkaService`, `KafkaConsumer` и `on` для отдельного топика принимает **только** эти два типа middleware — middleware Web и Console использовать нельзя. Порядок выполнения: уровень сервиса → группа консьюмеров → топик.

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

Обязательно вызывайте `await next()`, иначе `action` не запустится. Один экземпляр нельзя использовать для параллельных вызовов `consume`. Для второй группы создайте ещё один сервис с помощью `createKafkaService`. Подробнее о middleware: [Middleware](/ru/core/middleware).

## Подключение к production-кластеру

Для локального broker без шифрования дополнительные настройки не нужны. Для TLS или учётных данных добавьте параметры в фабрику (сертификаты и ключи можно передавать как PEM-строки, Buffer или массивы этих значений; SASL-механизм `aws` не поддерживается):

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

При необходимости добавьте здесь и другие параметры. `allowAutoTopicCreation` удобно использовать локально. Для `sessionTimeout` / `heartbeatInterval` можно указать `DurationInput`, например `'30s'`; heartbeat должен быть меньше времени ожидания сессии. Значение `maxMessageBytes` по умолчанию — 1 MiB; сообщения, превышающие лимит, отклоняются как при отправке, так и при получении. Идемпотентный продюсер включён по умолчанию, поэтому требуется `acks: -1`. Если задать `acks: 1` или `0`, одновременно отключите `idempotent`.

По умолчанию сообщения кодируются в JSON. Чтобы изменить формат во всём приложении, задайте `encode` / `decode`. Результат `encode` также ограничен значением `maxMessageBytes`.

## Что дальше

- Подключение сервисов к App: [Services](/ru/core/service)
- Команды Console: [Commander](/ru/console/commander)
- Общий Logger: [Логирование](/ru/core/logger)
- Проверка полей топика: [Validators](/ru/validators/)
