---
outline: deep
---

# Логи

Сделайте **LoggerService**, в `createTransports` объявите, куда писать; зарегистрируйте в `combineServices` и **прогрейте через eager**. Web / Console делят один `services.logger`, и он же закрывает обязательный `logger` у WebApp.

```bash
pnpm add @aomex/logger
```

```typescript
import {
  BaseLoggerService,
  ConsoleTransport,
  FileTransport,
} from '@aomex/logger';

export default class LoggerService extends BaseLoggerService {
  protected createTransports() { // [!code focus:9]
    return [
      { transport: new ConsoleTransport(), level: 'debug' },
      {
        transport: new FileTransport({ file: './logs/app.log' }),
        level: 'warn', // [!code highlight]
      },
    ];
  }
}
```

```typescript
export const services = await combineServices(
  {
    logger: () => import('./logger.service.js'),
  },
  { eager: ['logger'] }, // [!code highlight]
);

await services.logger.info('服务已就绪');
await services.logger.error(err, '结账失败');
```

У WebApp кроме `services` отдельно передайте `logger: services.logger` (та же ссылка):

```typescript
new WebApp({
  services,
  logger: services.logger, // [!code highlight]
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

## Уровни и сигнатуры

У каждой записи есть **level**: шум растёт от trace к fatal; `level` в таблице выходов решает, «насколько шумно» попадёт в этот канал. У error / fatal первый аргумент — `Error`, у остальных обычно `(message, context?)`.

- trace / debug / info / warn: (message, context?)
- error / fatal: (err, message, context?)
- у каждого выхода level — один уровень или интервал `{ min, max }`

От шумного к тихому: trace → debug → info → warn → error → fatal.

::: warning
Долгий debug / trace в проде убивает горячий путь и диск; бизнес-сбои — `error`, `fatal` — когда процесс нездоров, не помечайте каждый сбой как fatal.
:::

```typescript
await services.logger.info('服务已就绪');
await services.logger.error(err, '结账失败');
await services.logger.fatal(err, '数据库不可用，准备退出');
```

## Сначала выберите выход

| Выход | Пакет | Когда |
| --- | --- | --- |
| [ConsoleTransport](#consoletransport) | `@aomex/logger` | локальная разработка, stdout контейнера |
| [FileTransport](#filetransport) | `@aomex/logger` | на диск, файлы по дню / уровню |
| [StreamTransport](#streamtransport) | `@aomex/logger` | любой Writable (тесты, пайп) |
| [WebhookTransport](#webhooktransport) | `@aomex/logger` | свой HTTP-хук |
| [CustomTransport](#customtransport) | `@aomex/logger` | своя очередь / БД / SDK вендора |
| [SentryTransport](#sentrytransport) | `@aomex/logger-sentry` | error в Sentry |
| [TelegramTransport](#telegramtransport) | `@aomex/logger-telegram` | fatal разбудит людей |

Типичная продакшен-связка: консоль info + файл warn + Sentry error + Telegram fatal. У каждого выхода свой level — не сваливайте весь шум в один канал. Ниже — как настраивать каждый выход.

---

### ConsoleTransport

В терминал. На TTY text по умолчанию с цветом; для NDJSON в пайп сбора — `format: 'json'` и без цвета.

```typescript
{ transport: new ConsoleTransport(), level: 'debug' },
```

```typescript
new ConsoleTransport({
  format: 'json',
  colorize: false,
});
```

Без `output` error / fatal идут в stderr, остальное — в stdout; чтобы всё в один поток — задайте `output`. `colors` меняет раскраску уровней.

### FileTransport

Дописывает локальный файл; каталог создаётся сам. Фиксированного пути часто хватает одной строкой; для разбиения по дню / уровню — плейсхолдеры `{year}` / `{month}` / `{day}` / `{level}` (или `(log) => path`).

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

Для Fluent Bit и т.п. — `format: 'json'`. Права — через `fileMode` / `dirMode`.

### StreamTransport

Любой Writable (фейковый поток в unit-тестах, пайп процесса):

```typescript
new StreamTransport({
  stream: process.stdout,
  format: 'json',
});
```

`stream` обязателен; `format` по умолчанию text.

### WebhookTransport

HTTP на алерт / свой коллектор. Медленный хук — поднимите `timeoutMs` (по умолчанию около `30000`); авторизация — `headers`.

```typescript
new WebhookTransport({
  url: process.env.ALERT_WEBHOOK_URL!, // [!code highlight]
  headers: { Authorization: `Bearer ${process.env.HOOK_TOKEN}` },
  format: 'json',
});
```

`format` может быть функцией — сами соберёте body. method по умолчанию POST.

### CustomTransport

Своя логика потребления; на `this` доступен `formatLog`.

```typescript
new CustomTransport({
  async consume(log) { // [!code highlight]
    await myQueue.push(this.formatLog(log, 'json'));
  },
});
```

Сбой одной записи обычно не блокирует другие выходы. Для более тонкого контроля наследуйте Transport.

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

DSN — из переменных окружения, не в репозиторий. level лучше не ниже error — не заливайте info в Sentry. Перед shutdown дождаться отправки — `flushTimeout` (по умолчанию около `2000`).

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

Подходит для «процесс падает — разбудить людей»; не привязывайте кучу warn. В интервале одинаковый отпечаток сливается (`dedupe`, около 30 s; `false` выключает). `timeout` включает автоповторы, по умолчанию около `120000`.

## Комбинация нескольких выходов

Соберите выше в один Service и разведите по уровням:

```typescript
import { BaseLoggerService, ConsoleTransport, FileTransport } from '@aomex/logger';
import { SentryTransport } from '@aomex/logger-sentry';
import { TelegramTransport } from '@aomex/logger-telegram';

class LoggerService extends BaseLoggerService {
  protected createTransports() { // [!code highlight]
    return [
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
    ];
  }
}
```

Можно оставить только файл и отдать Fluent Bit — приложение тоньше.

## Контекст запроса: withBindings

Чтобы в разборе было ясно «эта запись к какому запросу»: ближе к началу Web mount оберните `next()`, нижестоящие логи сами получат поля.

```typescript
import { middleware } from '@aomex/common';

export const bindRequestLog = middleware.web(async (ctx, next) => {
  const requestId =
    ctx.request.headers['x-request-id']?.toString() || crypto.randomUUID();

  await ctx.logger.withBindings( // [!code highlight]
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

После аутентификации допишите userId (слияние с внешним; одноимённый ключ перекрывается внутренним):

```typescript
await ctx.logger.withBindings({ userId: ctx.auth.bearer.data.id }, next);
```

В Console / Cron то же для `services.logger.withBindings`. Перед shutdown или концом теста можно `await services.logger.flush()`.

::: warning
`withBindings` должен обернуть `await next()` в колбэке, иначе нижестоящие логи могут оказаться вне того же контекста.
:::

## Связанное

- [Сервисный слой](/ru/core/service)
- [Middleware](/ru/core/middleware)
- [Access log](/ru/plugins/access-log) (одна строка HTTP с длительностью; дополняет уровневые выходы)
