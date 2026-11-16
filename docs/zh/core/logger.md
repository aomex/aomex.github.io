---
outline: deep
---

# 日志

做一个 **LoggerService**，在 createTransports 里声明往哪儿打；注册进 combineServices 并 **eager 预热**。Web / Console 共用同一个 services.logger，并满足 WebApp 必填的 logger。

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

WebApp 除 services 外还要单独传 `logger: services.logger`（同一引用即可）：

```typescript
new WebApp({
  services,
  logger: services.logger, // [!code highlight]
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

## 等级与签名

每条日志带 **level**：吵度从 trace 到 fatal 递增，出口表里设的 level 决定「多吵的才进这个通道」。签名上 error / fatal 第一个参数是 `Error`，其余等级一般 `(message, context?)`。

- trace / debug / info / warn：(message, context?)
- error / fatal：(err, message, context?)
- 每条出口的 level 可以是单一等级，或 { min, max } 区间

等级从吵到安静：trace → debug → info → warn → error → fatal。

::: warning
生产长期开 debug / trace 会让热路径和磁盘都受不了；业务失败用 error，fatal 留给进程不健康，别把所有失败都打成 fatal。
:::

```typescript
await services.logger.info('服务已就绪');
await services.logger.error(err, '结账失败');
await services.logger.fatal(err, '数据库不可用，准备退出');
```

## 出口列表

| 出口 | 包 | 什么时候用 |
| --- | --- | --- |
| [ConsoleTransport](#consoletransport) | `@aomex/logger` | 本地开发、容器 stdout |
| [FileTransport](#filetransport) | `@aomex/logger` | 落盘、按日/等级分文件 |
| [StreamTransport](#streamtransport) | `@aomex/logger` | 写任意 Writable（测试、管道） |
| [WebhookTransport](#webhooktransport) | `@aomex/logger` | 推到自定义 HTTP 钩子 |
| [CustomTransport](#customtransport) | `@aomex/logger` | 自建队列 / DB / 厂商 SDK |
| [SentryTransport](#sentrytransport) | `@aomex/logger-sentry` | error 进 Sentry |
| [TelegramTransport](#telegramtransport) | `@aomex/logger-telegram` | fatal 叫醒人 |

生产常见组合：控制台 info + 文件 warn + Sentry error + Telegram fatal。每个出口自己设 level，别一个通道扛全部噪音。

---

### ConsoleTransport

打到终端。TTY 下 text 默认着色；采集管道可改 json。

```typescript
{ transport: new ConsoleTransport(), level: 'debug' },
```

```typescript
new ConsoleTransport({
  format: 'json',
  colorize: false,
});
```

| 选项 | 什么时候用 | 默认 |
| --- | --- | --- |
| `format` | 采集要用 NDJSON 时设 `'json'` | `'text'` |
| `colorize` | 强制开关着色 | text 且 TTY 时开 |
| `colors` | 改等级配色 | 内置 |
| `output` | 所有等级走同一流 | — |
| `stderrLevels` | 未设 `output` 时哪些等级进 stderr | `error` / `fatal` |

### FileTransport

追加写本地文件；目录不存在会自动建。

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

| 选项 | 什么时候用 | 默认 |
| --- | --- | --- |
| `file` | 固定路径，或带 `{year}`/`{level}` 占位；也可 `(log) => path` | 按日+等级分文件 |
| `format` | 给 Fluent Bit 等时用 `'json'` | `'text'` |
| `fileMode` / `dirMode` | 要收紧权限时 | 系统默认 |

### StreamTransport

写任意 Writable（单元测试假流、进程管道）。

```typescript
new StreamTransport({
  stream: process.stdout,
  format: 'json',
});
```

| 选项 | 什么时候用 |
| --- | --- |
| `stream` | 必填，目标 Writable |
| `format` | `'text'` / `'json'`，默认 text |

### WebhookTransport

HTTP 推到告警 / 自建收集端点。

```typescript
new WebhookTransport({
  url: process.env.ALERT_WEBHOOK_URL!, // [!code highlight]
  headers: { Authorization: `Bearer ${process.env.HOOK_TOKEN}` },
  format: 'json',
});
```

| 选项 | 什么时候用 | 默认 |
| --- | --- | --- |
| `url` | 必填，钩子地址 | — |
| `method` | 非 POST 时 | `POST` |
| `headers` | 鉴权、自定义头 | — |
| `format` | `'json'` / `'text'`，或函数拼 body | `'json'` |
| `timeoutMs` | 慢钩子调大 | `30000` |

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

| 选项 | 什么时候用 | 默认 |
| --- | --- | --- |
| `dsn` | 必填；构造时会 `Sentry.init` | — |
| `flushTimeout` | 关停前等上报 | `2000` |

DSN 走环境变量，别写进仓库。level 建议至少 error，别把 info 灌进 Sentry。

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

| 选项 | 什么时候用 | 默认 |
| --- | --- | --- |
| `botToken` / `chatId` | 必填，来自 BotFather / 群 id | — |
| `timeout` | 含自动重试的总超时 | `120000` |
| `format` | 自定义消息正文 | 内置 |
| `dedupe` | 间隔内同指纹合并；`false` 关闭 | 开（约 30s） |

适合「进程要挂了再叫人」；别绑一大堆 warn。

## 多出口组合

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

也可以只要文件、交给 Fluent Bit 等转发——应用侧更瘦。

## 请求级上下文：withBindings

排查时要「这条日志属于哪个请求」：在 Web mount 靠前包住 next()，下游日志自动带字段。

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

鉴权后再补 userId（与外层合并，同名键内层覆盖）：

```typescript
await ctx.logger.withBindings({ userId: ctx.auth.bearer.data.id }, next);
```

Console / Cron 里对 services.logger.withBindings 同样适用。关停或测试结束前可 await services.logger.flush()。

::: warning
withBindings 必须把 await next() 包在回调里，否则下游日志可能不在同一上下文。
:::

## 相关

- [服务层](/zh/core/service)
- [中间件](/zh/core/middleware)
- [访问日志](/zh/plugins/http-access-log)（HTTP 一行耗时，和分级出口互补）