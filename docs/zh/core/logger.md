---
outline: deep
---

# 日志

用 `new Logger({ transports })` 声明往哪儿打；把**同一个实例**传给 Web / Console / WebSocket 的 `logger`。首次写日志时懒连接，关停时经内部 `registerLifecycle` 自动销毁。

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

业务代码直接 `import { logger } from '@/services/logger.service'` 即可。`ctx.logger` 与它是**同一引用**，给**第三方中间件**和 **app 内中间件**用（只拿到 ctx 时）；两边打日志效果一样。

## 等级与签名

每条日志带 **level**：吵度从 trace 到 fatal 递增，出口表里设的 level 决定「多吵的才进这个通道」。

- trace / debug / info：只收文案 `(message)`
- warn / error / fatal：`(message)`，或 `(err)` / `(err, message)`——`err` 是 `unknown`（含 `catch` 值），会序列化进 `exception`
- 结构化字段用 [withBindings](#请求级上下文withbindings)，不要再往 info 后面塞对象
- 每条出口的 level 可以是单一等级，或 `{ min, max }` 区间

等级从吵到安静：trace → debug → info → warn → error → fatal。

写日志方法是**同步**的（返回 `void`），不用 `await`；要等队列刷完再关进程时再 `await logger.flush()`。

::: warning
生产长期开 debug / trace 会让热路径和磁盘都受不了；业务失败用 error，fatal 留给进程不健康，别把所有失败都打成 fatal。框架**不会**按 `NODE_ENV` 自动关等级——靠各 transport 的 `level` 门禁。
:::

```typescript
import { logger } from '@/services/logger.service';

logger.info('服务已就绪');
logger.error(err, '结账失败');
logger.fatal(err, '数据库不可用，准备退出');
```

## 先选出口

| 出口 | 包 | 什么时候用 |
| --- | --- | --- |
| [ConsoleTransport](#consoletransport) | `@aomex/logger` | 本地开发、容器 stdout |
| [FileTransport](#filetransport) | `@aomex/logger` | 落盘、按日/等级分文件 |
| [StreamTransport](#streamtransport) | `@aomex/logger` | 写任意 Writable（测试、管道） |
| [WebhookTransport](#webhooktransport) | `@aomex/logger` | 推到自定义 HTTP 钩子 |
| [CustomTransport](#customtransport) | `@aomex/logger` | 自建队列 / DB / 厂商 SDK |
| [SentryTransport](#sentrytransport) | `@aomex/logger-sentry` | error 进 Sentry |
| [TelegramTransport](#telegramtransport) | `@aomex/logger-telegram` | fatal 叫醒人 |

生产常见组合：控制台 info + 文件 warn + Sentry error + Telegram fatal。每个出口自己设 level，别一个通道扛全部噪音。下面按出口讲怎么配。

---

### ConsoleTransport

打到终端。TTY 下 text 默认着色；采集管道要 NDJSON 时改 `format: 'json'`，并关掉着色。

```typescript
{ transport: new ConsoleTransport(), level: 'debug' },
```

```typescript
new ConsoleTransport({
  format: 'json',
  colorize: false,
});
```

未设 `output` 时，error / fatal 默认进 stderr，其余进 stdout；要全部进同一流时再设 `output`。`colors` 可改等级配色。

### FileTransport

追加写本地文件；目录不存在会自动建。固定路径够用就一行；要按日 / 等级分文件，用 `{year}` / `{month}` / `{day}` / `{level}` 占位（也可 `(log) => path`）。

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

给 Fluent Bit 等转发时用 `format: 'json'`。要收紧权限再动 `fileMode` / `dirMode`。

### StreamTransport

写任意 Writable（单元测试假流、进程管道）：

```typescript
new StreamTransport({
  stream: process.stdout,
  format: 'json',
});
```

`stream` 必填；`format` 默认 text。

### WebhookTransport

HTTP 推到告警 / 自建收集端点。慢钩子可把 `timeoutMs` 调大（默认约 `30000`）；鉴权走 `headers`。

```typescript
new WebhookTransport({
  url: process.env.ALERT_WEBHOOK_URL!, // [!code highlight]
  headers: { Authorization: `Bearer ${process.env.HOOK_TOKEN}` },
  format: 'json',
});
```

`format` 也可是函数，自己拼 body。method 默认 POST。

### CustomTransport

自建消费逻辑；this 上可调 formatLog。

```typescript
new CustomTransport({
  async consume(log) { // [!code highlight]
    await myQueue.push(this.formatLog(log, 'json'));
  },
});
```

单条失败一般不堵其它出口。需要更细控制时可继承 Transport。

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

DSN 走环境变量，别写进仓库。level 建议至少 error，别把 info 灌进 Sentry。关停前等上报可用 `flushTimeout`（默认约 `2000`）。

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

适合「进程要挂了再叫人」；别绑一大堆 warn。间隔内同指纹会合并（`dedupe`，约 30s；设 `false` 关闭）。`timeout` 含自动重试，默认约 `120000`。

## 多出口组合

把上面拼进同一份 `Logger`，按等级分流：

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

也可以只要文件、交给 Fluent Bit 等转发——应用侧更瘦。某条出口临时关掉时设 `disabled: true`（不 `onInit` / 不投递 / 不 `flush`）。

## 请求级上下文：withBindings

排查时要「这条日志属于哪个请求」：在 Web mount 靠前包住 next()，下游日志自动带字段。

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

鉴权后再补 userId（与外层合并，同名键内层覆盖）：

```typescript
await logger.withBindings({ userId: ctx.auth.bearer.data.id }, next);
```

Console / Cron 同样用这份 `logger`。关停或测试结束前可 `await logger.flush()`。

::: warning
withBindings 必须把 await next() 包在回调里，否则下游日志可能不在同一上下文。
:::

## 相关

- [服务层](/zh/core/service)
- [中间件](/zh/core/middleware)
- [访问日志](/zh/plugins/access-log)（HTTP 一行耗时，和分级出口互补）
