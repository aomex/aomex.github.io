---
outline: deep
---

# Логирование

Объявите назначения через `new Logger({ transports })` и передайте **тот же экземпляр** в `logger` Web / Console / WebSocket. Первый лог — ленивое подключение; при остановке — уничтожение через внутренний `registerLifecycle`.

```bash
pnpm add @aomex/logger
```

```typescript
// src/services/logger.service.ts
import { Logger, ConsoleTransport, FileTransport } from '@aomex/logger';

export const logger = new Logger({ // [!code focus:9]
  transports: [
    { transport: new ConsoleTransport(), level: 'debug' },
    {
      transport: new FileTransport({ file: './logs/app.log' }),
      level: 'warn', // [!code highlight]
    },
  ],
});
```

```typescript
import { WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';
import { services } from '@/services';

new WebApp({
  services,
  logger, // [!code highlight]
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});

logger.info('服务已就绪');
logger.error(err, '结账失败');
```

В бизнес-коде — `import { logger } from '@/services/logger.service'`. `ctx.logger` — **та же ссылка**, для **стороннего middleware** и **middleware внутри app** (когда есть только ctx); вывод одинаковый.

## Уровни и сигнатуры

У каждой записи есть **level**: от trace до fatal «громче»; `level` у transport решает, что проходит в этот выход.

- trace / debug / info: только текст `(message)`
- warn / error / fatal: `(message)` или `(err)` / `(err, message)` — `err` типа `unknown` (включая из `catch`), сериализуется в `exception`
- структурированные поля — [withBindings](#контекст-запроса-withbindings), не дописывайте объекты после info
- `level` выхода — один уровень или интервал `{ min, max }`

От шумного к тихому: trace → debug → info → warn → error → fatal.

Методы логирования **синхронные** (`void`), без `await`. `await logger.flush()` — когда нужно слить очередь перед выходом процесса.

::: warning
Постоянный debug / trace в проде бьёт по hot path и диску. Ошибки бизнеса — error, fatal — когда процесс нездоров; не маркируйте всё как fatal. Фреймворк **не** режет уровни по `NODE_ENV` — настраивайте `level` у каждого transport.
:::

```typescript
import { logger } from '@/services/logger.service';

logger.info('服务已就绪');
logger.error(err, '结账失败');
logger.fatal(err, '数据库不可用，准备退出');
```

## Выбор выходов

| Выход | Пакет | Когда |
| --- | --- | --- |
| [ConsoleTransport](#consoletransport) | `@aomex/logger` | локальная разработка, stdout контейнера |
| [FileTransport](#filetransport) | `@aomex/logger` | файлы, разделение по дню / уровню |
| [StreamTransport](#streamtransport) | `@aomex/logger` | любой Writable (тесты, pipe) |
| [WebhookTransport](#webhooktransport) | `@aomex/logger` | свой HTTP-хук |
| [CustomTransport](#customtransport) | `@aomex/logger` | очередь / БД / SDK вендора |
| [SentryTransport](#sentrytransport) | `@aomex/logger-sentry` | error в Sentry |
| [TelegramTransport](#telegramtransport) | `@aomex/logger-telegram` | fatal будит людей |

Типичный прод: консоль info + файл warn + Sentry error + Telegram fatal. У каждого выхода свой level, не один канал на весь шум. Ниже — настройка по выходам.

---

### ConsoleTransport

В терминал. В TTY text по умолчанию с цветом. Для сбора NDJSON — `format: 'json'` и `colorize: false`.

```typescript
{ transport: new ConsoleTransport(), level: 'debug' },
```

```typescript
new ConsoleTransport({
  format: 'json',
  colorize: false,
});
```

Без `output` error / fatal — stderr, остальное stdout; один поток — задайте `output`. `colors` меняет раскраску уровней.

### FileTransport

Дозапись в локальный файл; каталог создаётся сам. Фиксированный путь — одна строка; по дню / уровню — плейсхолдеры `{year}` / `{month}` / `{day}` / `{level}` (или `(log) => path`).

```typescript
{
  transport: new FileTransport({ file: './logs/app.log' }),
  level: 'warn',
},
```

```typescript
new FileTransport({
  file: './logs/{year}-{month}-{day}/{level}.log', // [!code highlight]
  format: 'json',
});
```

Для Fluent Bit и т.п. — `format: 'json'`. Права — `fileMode` / `dirMode`.

### StreamTransport

Любой Writable (фейковый поток в тестах, pipe процесса):

```typescript
new StreamTransport({
  stream: process.stdout,
  format: 'json',
});
```

`stream` обязателен; `format` по умолчанию text.

### WebhookTransport

HTTP на алерт / свой коллектор. Медленный хук — увеличьте `timeoutMs` (по умолчанию ~`30000`); auth — `headers`.

```typescript
new WebhookTransport({
  url: process.env.ALERT_WEBHOOK_URL!, // [!code highlight]
  headers: { Authorization: `Bearer ${process.env.HOOK_TOKEN}` },
  format: 'json',
});
```

`format` может быть функцией для своего body. method по умолчанию POST.

### CustomTransport

Свой consume; на `this` доступен `formatLog`.

```typescript
new CustomTransport({
  async consume(log) { // [!code highlight]
    await myQueue.push(this.formatLog(log, 'json'));
  },
});
```

Сбой одной записи обычно не блокирует другие выходы. Тонкая настройка — наследование Transport.

### SentryTransport

```bash
pnpm add @aomex/logger-sentry
```

```typescript
import { SentryTransport } from '@aomex/logger-sentry';

{
  transport: new SentryTransport({
    dsn: process.env.SENTRY_DSN!,
  }),
  level: 'error', // [!code highlight]
},
```

DSN из окружения, не в репозитории. level не ниже error, не заливайте info в Sentry. Перед остановкой — `flushTimeout` (по умолчанию ~`2000`).

### TelegramTransport

```bash
pnpm add @aomex/logger-telegram
```

```typescript
import { TelegramTransport } from '@aomex/logger-telegram';

{
  transport: new TelegramTransport({
    botToken: process.env.TG_BOT_TOKEN!,
    chatId: process.env.TG_CHAT_ID!,
  }),
  level: 'fatal', // [!code highlight]
},
```

Когда «процесс умирает — разбудить человека»; не вешайте кучу warn. Одинаковый отпечаток в интервале сливается (`dedupe`, ~30s; `false` отключает). `timeout` с авто-ретраями, по умолчанию ~`120000`.

## Несколько выходов

Соберите в одном `Logger`, разведите по уровням:

```typescript
import { Logger, ConsoleTransport, FileTransport } from '@aomex/logger';
import { SentryTransport } from '@aomex/logger-sentry';
import { TelegramTransport } from '@aomex/logger-telegram';

export const logger = new Logger({
  transports: [ // [!code highlight]
    { transport: new ConsoleTransport(), level: 'info' },
    {
      transport: new FileTransport({ file: './logs/app.log', format: 'json' }),
      level: 'warn',
    },
    {
      transport: new SentryTransport({ dsn: process.env.SENTRY_DSN! }),
      level: 'error',
    },
    {
      transport: new TelegramTransport({
        botToken: process.env.TG_BOT_TOKEN!,
        chatId: process.env.TG_CHAT_ID!,
      }),
      level: 'fatal',
    },
  ],
});
```

Можно только файл и Fluent Bit — приложение тоньше. Временно отключить выход — `disabled: true` (без `onInit` / доставки / `flush`).

## Контекст запроса: withBindings

Чтобы связать лог с запросом: рано в Web `mount` оберните `next()` — поля появятся на логах ниже.

```typescript
import { middleware } from '@aomex/common';
import { logger } from '@/services/logger.service';

export const bindRequestLog = middleware.web(async (ctx, next) => {
  const requestId =
    ctx.request.headers['x-request-id']?.toString() || crypto.randomUUID();

  await logger.withBindings( // [!code highlight]
    {
      requestId,
      method: ctx.request.method,
      path: ctx.request.pathname,
    },
    next,
  );
});
```

```typescript
mount: [
  bindRequestLog, // [!code highlight]
  httpAccessLog(),
  routers('./src/routers'),
],
```

После auth добавьте userId (слияние с внешним слоем, внутренний перекрывает совпадения):

```typescript
await logger.withBindings({ userId: ctx.auth.bearer.data.id }, next);
```

Console / Cron — тот же `logger`. Перед shutdown или концом теста — `await logger.flush()`.

::: warning
В withBindings обязательно оберните `await next()` в колбэке, иначе логи ниже могут оказаться вне контекста.
:::

## См. также

- [слой сервисов](/ru/core/service)
- [middleware](/ru/core/middleware)
- [access log](/ru/plugins/access-log) (одна строка HTTP с длительностью, дополняет разделение по уровням)