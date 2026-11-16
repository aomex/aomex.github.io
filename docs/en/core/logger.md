---
outline: deep
---

# Logger

Build **LoggerService**, declare sinks in `createTransports`, register with `combineServices` and **eager** warm-up. Web and Console share `services.logger`; satisfies `WebApp` required `logger`.

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

await services.logger.info('Service ready');
await services.logger.error(err, 'Checkout failed');
```

`WebApp` also needs `logger: services.logger` (same reference):

```typescript
new WebApp({
  services,
  logger: services.logger, // [!code highlight]
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

## Levels and signatures

Each log has a **level** from `trace` to `fatal`; sink `level` decides what passes. `error` / `fatal` first arg is `Error`; others `(message, context?)`.

- trace / debug / info / warn: `(message, context?)`
- error / fatal: `(err, message, context?)`
- Per-sink `level` may be a single level or `{ min, max }` range

Loudest to quiet: trace → debug → info → warn → error → fatal.

::: warning
Leaving debug/trace on in production hurts hot paths and disks; use `error` for business failures, `fatal` for process unhealthy—not every failure as fatal.
:::

```typescript
await services.logger.info('Service ready');
await services.logger.error(err, 'Checkout failed');
await services.logger.fatal(err, 'Database unavailable, exiting');
```

## Transports

| Transport | Package | When to use |
| --- | --- | --- |
| [ConsoleTransport](#consoletransport) | `@aomex/logger` | Local dev, container stdout |
| [FileTransport](#filetransport) | `@aomex/logger` | Files, daily/level split |
| [StreamTransport](#streamtransport) | `@aomex/logger` | Any Writable (tests, pipes) |
| [WebhookTransport](#webhooktransport) | `@aomex/logger` | Custom HTTP hooks |
| [CustomTransport](#customtransport) | `@aomex/logger` | Queue / DB / vendor SDK |
| [SentryTransport](#sentrytransport) | `@aomex/logger-sentry` | Errors to Sentry |
| [TelegramTransport](#telegramtransport) | `@aomex/logger-telegram` | Fatal alerts |

Common production: console info + file warn + Sentry error + Telegram fatal. Set `level` per sink—one channel should not take all noise.

---

### ConsoleTransport

Terminal output. TTY + `text` colors by default; pipelines may use `json`.

```typescript
{ transport: new ConsoleTransport(), level: 'debug' },
```

```typescript
new ConsoleTransport({
  format: 'json',
  colorize: false,
});
```

| Option | When to use | Default |
| --- | --- | --- |
| `format` | NDJSON collectors → `'json'` | `'text'` |
| `colorize` | Force color on/off | on for text+TTY |
| `colors` | Level color map | built-in |
| `output` | All levels to one stream | — |
| `stderrLevels` | Without `output`, levels to stderr | `error` / `fatal` |

### FileTransport

Append to local files; creates directories.

```typescript
{
  transport: new FileTransport({ file: './logs/app.log' }),
  level: 'warn',
},
```

```typescript
new FileTransport({
  file: './logs/{year}-{month}-{day}/{level}.log',
  format: 'json',
});
```

| Option | When to use | Default |
| --- | --- | --- |
| `file` | Fixed path, `{year}`/`{level}` placeholders, or `(log) => path` | daily+level split |
| `format` | Fluent Bit etc. → `'json'` | `'text'` |
| `fileMode` / `dirMode` | Tighten permissions | OS default |

### StreamTransport

Any Writable (test doubles, pipes).

```typescript
new StreamTransport({
  stream: process.stdout,
  format: 'json',
});
```

| Option | When to use |
| --- | --- |
| `stream` | Required Writable |
| `format` | `'text'` / `'json'`, default text |

### WebhookTransport

HTTP to alert or custom collectors.

```typescript
new WebhookTransport({
  url: process.env.ALERT_WEBHOOK_URL!, // [!code highlight]
  headers: { Authorization: `Bearer ${process.env.HOOK_TOKEN}` },
  format: 'json',
});
```

| Option | When to use | Default |
| --- | --- | --- |
| `url` | Required webhook URL | — |
| `method` | Non-POST | `POST` |
| `headers` | Auth, custom headers | — |
| `format` | `'json'` / `'text'` or function body | `'json'` |
| `timeoutMs` | Slow webhooks | `30000` |

### CustomTransport

Custom consume logic; `this.formatLog` available.

```typescript
new CustomTransport({
  async consume(log) { // [!code highlight]
    await myQueue.push(this.formatLog(log, 'json'));
  },
});
```

Single failure usually does not block other sinks. Extend `Transport` for finer control.

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

| Option | When to use | Default |
| --- | --- | --- |
| `dsn` | Required; calls `Sentry.init` | — |
| `flushTimeout` | Wait on shutdown | `2000` |

DSN from env—not committed. Level at least `error`; do not flood Sentry with info.

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

| Option | When to use | Default |
| --- | --- | --- |
| `botToken` / `chatId` | Required from BotFather / chat | — |
| `timeout` | Total timeout with retries | `120000` |
| `format` | Custom message body | built-in |
| `dedupe` | Merge same fingerprint in window; `false` off | on (~30s) |

For “wake someone when process dies”—not every warn.

## Multiple transports

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

Or file-only + Fluent Bit forwarding—leaner app.

## Request-scoped context: withBindings

Correlate logs to a request: wrap `next()` early in Web `mount`.

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

After auth, add `userId` (merged; inner keys win):

```typescript
await ctx.logger.withBindings({ userId: ctx.auth.bearer.data.id }, next);
```

`services.logger.withBindings` works in Console / Cron too. Before shutdown or tests: `await services.logger.flush()`.

::: warning
`withBindings` must wrap `await next()` in the callback—or downstream logs miss the context.
:::

## Related

- [Services](/en/core/service)
- [Middleware](/en/core/middleware)
- [Access log](/en/plugins/http-access-log) (one HTTP line per request—complements level-based sinks)