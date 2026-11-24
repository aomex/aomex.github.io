---
outline: deep
---

# Logging

Build a **LoggerService**, declare where logs go in `createTransports`, register it with `combineServices`, and **eager-warm** it. Web and Console share the same `services.logger`, which also satisfies WebApp’s required `logger`.

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

await services.logger.info('service ready');
await services.logger.error(err, 'checkout failed');
```

Besides `services`, WebApp also needs `logger: services.logger` separately (same reference is fine):

```typescript
new WebApp({
  services,
  logger: services.logger, // [!code highlight]
  language: { mode: 'fixed', language: 'en-US' },
  proxyIP: { mode: 'detect' },
});
```

## Levels and signatures

Every log line has a **level**: noisiness grows from trace to fatal; the level on each transport decides “how noisy before this channel accepts it”. For `error` / `fatal` the first argument is an `Error`; other levels are usually `(message, context?)`.

- trace / debug / info / warn: (message, context?)
- error / fatal: (err, message, context?)
- Each transport’s level can be a single level or a `{ min, max }` range

From noisy to quiet: trace → debug → info → warn → error → fatal.

::: warning
Leaving debug / trace on in production for long hammers hot paths and disk; use error for business failures, and reserve fatal for an unhealthy process—do not mark every failure as fatal.
:::

```typescript
await services.logger.info('service ready');
await services.logger.error(err, 'checkout failed');
await services.logger.fatal(err, 'database unavailable, preparing to exit');
```

## Pick transports first

| Transport | Package | When to use |
| --- | --- | --- |
| [ConsoleTransport](#consoletransport) | `@aomex/logger` | Local development, container stdout |
| [FileTransport](#filetransport) | `@aomex/logger` | On disk, split by day / level |
| [StreamTransport](#streamtransport) | `@aomex/logger` | Any Writable (tests, pipes) |
| [WebhookTransport](#webhooktransport) | `@aomex/logger` | Push to a custom HTTP hook |
| [CustomTransport](#customtransport) | `@aomex/logger` | Your own queue / DB / vendor SDK |
| [SentryTransport](#sentrytransport) | `@aomex/logger-sentry` | Errors into Sentry |
| [TelegramTransport](#telegramtransport) | `@aomex/logger-telegram` | Wake someone on fatal |

A common production mix: console info + file warn + Sentry error + Telegram fatal. Each transport sets its own level—do not push all noise through one channel. Below: how to configure each.

---

### ConsoleTransport

Writes to the terminal. On a TTY, text is colorized by default; for NDJSON into a collector set `format: 'json'` and turn color off.

```typescript
{ transport: new ConsoleTransport(), level: 'debug' },
```

```typescript
new ConsoleTransport({
  format: 'json',
  colorize: false,
});
```

Without `output`, error / fatal go to stderr by default and the rest to stdout; set `output` when everything should share one stream. `colors` can retune level colors.

### FileTransport

Appends to a local file; missing directories are created. A fixed path is enough for a one-liner; to split by day / level, use `{year}` / `{month}` / `{day}` / `{level}` placeholders (or `(log) => path`).

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

Use `format: 'json'` when forwarding to Fluent Bit and similar. Tighten permissions with `fileMode` / `dirMode` when needed.

### StreamTransport

Write to any Writable (fake streams in unit tests, process pipes):

```typescript
new StreamTransport({
  stream: process.stdout,
  format: 'json',
});
```

`stream` is required; `format` defaults to text.

### WebhookTransport

HTTP push to an alert / custom collector endpoint. Slow hooks can raise `timeoutMs` (default about `30000`); auth goes in `headers`.

```typescript
new WebhookTransport({
  url: process.env.ALERT_WEBHOOK_URL!, // [!code highlight]
  headers: { Authorization: `Bearer ${process.env.HOOK_TOKEN}` },
  format: 'json',
});
```

`format` can also be a function that builds the body. Method defaults to POST.

### CustomTransport

Your own consume logic; call `formatLog` on `this`.

```typescript
new CustomTransport({
  async consume(log) { // [!code highlight]
    await myQueue.push(this.formatLog(log, 'json'));
  },
});
```

A single failure usually does not block other transports. Subclass `Transport` for finer control.

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

Keep the DSN in an env var—do not commit it. Prefer at least `error` for level; do not flood Sentry with info. Use `flushTimeout` (default about `2000`) to wait for reports before shutdown.

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

Fits “page a human when the process is about to die”; do not bind a flood of warn. Same fingerprints within the interval are merged (`dedupe`, about 30s; set `false` to disable). `timeout` includes automatic retries, default about `120000`.

## Combining multiple transports

Wire the above into one Service and split by level:

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

You can also file-only and let Fluent Bit (etc.) forward—thinner on the app side.

## Request-scoped context: withBindings

When debugging you want “which request does this log belong to”: wrap `next()` early in Web mount so downstream logs carry the fields automatically.

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

Add `userId` after auth (merged with the outer scope; same keys override from the inside):

```typescript
await ctx.logger.withBindings({ userId: ctx.auth.bearer.data.id }, next);
```

The same pattern works on `services.logger.withBindings` in Console / Cron. You can `await services.logger.flush()` before shutdown or when tests finish.

::: warning
`withBindings` must wrap `await next()` inside the callback, or downstream logs may leave that context.
:::

## Related

- [Services](/en/core/service)
- [Middleware](/en/core/middleware)
- [Access log](/en/plugins/http-access-log) (one HTTP timing line; complements leveled transports)
