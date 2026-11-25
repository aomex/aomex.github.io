---
outline: deep
---

# Logging

Create a logger with `new Logger({ transports })` and pass the **same instance** to Web / Console / WebSocket as `logger`. The first write connects lazily; shutdown tears it down via internal `registerLifecycle`.

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
  language: { mode: 'fixed', language: 'en-US' },
  proxyIP: { mode: 'detect' },
});

logger.info('service ready');
logger.error(err, 'checkout failed');
```

In app code, `import { logger } from '@/services/logger.service'`. `ctx.logger` is the **same reference**—for **third-party middleware** and **in-app middleware** that only have `ctx`; logging either way is identical.

## Levels and signatures

Every record has a **level**: noise rises from trace to fatal; each sink’s `level` decides how noisy a line must be to enter that channel.

- trace / debug / info: message only `(message)`
- warn / error / fatal: `(message)`, or `(err)` / `(err, message)`—`err` is `unknown` (including `catch` values) and is serialized into `exception`
- Structured fields go through [withBindings](#request-scoped-context-withbindings); do not append an object after info
- Per-sink `level` may be a single grade or a `{ min, max }` range

From noisy to quiet: trace → debug → info → warn → error → fatal.

Write methods are **synchronous** (`void`)—no `await`. Use `await logger.flush()` only when you need the queue drained before exit.

::: warning
Leaving debug / trace on in production hammers hot paths and disks; use error for business failures and fatal only when the process is unhealthy. The framework does **not** filter by `NODE_ENV`—gate with each transport’s `level`.
:::

```typescript
import { logger } from '@/services/logger.service';

logger.info('service ready');
logger.error(err, 'checkout failed');
logger.fatal(err, 'database unavailable, exiting');
```

## Pick sinks first

| Sink | Package | When to use |
| --- | --- | --- |
| [ConsoleTransport](#consoletransport) | `@aomex/logger` | Local dev, container stdout |
| [FileTransport](#filetransport) | `@aomex/logger` | On disk, rotate by day/level |
| [StreamTransport](#streamtransport) | `@aomex/logger` | Any Writable (tests, pipes) |
| [WebhookTransport](#webhooktransport) | `@aomex/logger` | Custom HTTP hooks |
| [CustomTransport](#customtransport) | `@aomex/logger` | Your queue / DB / vendor SDK |
| [SentryTransport](#sentrytransport) | `@aomex/logger-sentry` | Errors into Sentry |
| [TelegramTransport](#telegramtransport) | `@aomex/logger-telegram` | Wake someone on fatal |

Common production mix: console info + file warn + Sentry error + Telegram fatal. Gate each sink; do not dump every level into one channel.

---

### ConsoleTransport

Writes to the terminal. On a TTY, text is colorized by default; for NDJSON collectors set `format: 'json'` and turn color off.

```typescript
{ transport: new ConsoleTransport(), level: 'debug' },
```

```typescript
new ConsoleTransport({
  format: 'json',
  colorize: false,
});
```

Without `output`, error / fatal go to stderr and the rest to stdout; set `output` to force one stream. `colors` can retint levels.

### FileTransport

Appends to a local file; missing directories are created. A fixed path is enough for many apps; for day / level splits use `{year}` / `{month}` / `{day}` / `{level}` (or `(log) => path`).

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

Use `format: 'json'` when Fluent Bit (or similar) forwards the file. Tighten `fileMode` / `dirMode` only when you need stricter permissions.

### StreamTransport

Any Writable (fake streams in tests, process pipes):

```typescript
new StreamTransport({
  stream: process.stdout,
  format: 'json',
});
```

`stream` is required; `format` defaults to text.

### WebhookTransport

HTTP push to an alert / collector endpoint. Raise `timeoutMs` for slow hooks (default ~`30000`); auth goes in `headers`.

```typescript
new WebhookTransport({
  url: process.env.ALERT_WEBHOOK_URL!, // [!code highlight]
  headers: { Authorization: `Bearer ${process.env.HOOK_TOKEN}` },
  format: 'json',
});
```

`format` may also be a function that builds the body. Method defaults to POST.

### CustomTransport

Your own consume logic; `formatLog` is available on `this`.

```typescript
new CustomTransport({
  async consume(log) { // [!code highlight]
    await myQueue.push(this.formatLog(log, 'json'));
  },
});
```

A single sink failure usually does not block others. Subclass `Transport` when you need finer control.

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

Keep the DSN in env, not in the repo. Prefer at least error—do not flood Sentry with info. `flushTimeout` waits for upload before shutdown (default ~`2000`).

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

Best for “wake someone when the process is dying”; do not bind a pile of warns. Same-fingerprint lines merge within the window (`dedupe`, ~30s; `false` disables). `timeout` includes retries (default ~`120000`).

## Combining sinks

Wire the sinks above into one `Logger` and split by level:

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

File-only plus Fluent Bit is also fine—thinner app side. Set `disabled: true` to skip a sink temporarily (no `onInit` / deliver / `flush`).

## Request-scoped context: withBindings

To tag “which request owns this line”, wrap `next()` early in Web mount so downstream logs inherit fields.

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

After auth, add `userId` (merged with the outer scope; inner keys win):

```typescript
await logger.withBindings({ userId: ctx.auth.bearer.data.id }, next);
```

Console / Cron use the same `logger`. Call `await logger.flush()` before shutdown or when a test finishes.

::: warning
`withBindings` must wrap `await next()` in the callback; otherwise downstream logs may leave the context.
:::

## Related

- [Services](/en/core/service)
- [Middleware](/en/core/middleware)
- [Access log](/en/plugins/access-log) (one HTTP timing line; complements leveled sinks)
