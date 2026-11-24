---
outline: deep
---

# 日誌

做一個 **LoggerService**，在 createTransports 裡宣告往哪兒打；註冊進 combineServices 並 **eager 預熱**。Web / Console 共用同一個 services.logger，並滿足 WebApp 必填的 logger。

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

WebApp 除 services 外還要單獨傳 `logger: services.logger`（同一引用即可）：

```typescript
new WebApp({
  services,
  logger: services.logger, // [!code highlight]
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

## 等級與簽名

每條日誌帶 **level**：吵度從 trace 到 fatal 遞增，出口表裡設的 level 決定「多吵的才進這個通道」。簽名上 error / fatal 第一個引數是 `Error`，其餘等級一般 `(message, context?)`。

- trace / debug / info / warn：(message, context?)
- error / fatal：(err, message, context?)
- 每條出口的 level 可以是單一等級，或 { min, max } 區間

等級從吵到安靜：trace → debug → info → warn → error → fatal。

::: warning
生產長期開 debug / trace 會讓熱路徑和磁碟都受不了；業務失敗用 error，fatal 留給程序不健康，別把所有失敗都打成 fatal。
:::

```typescript
await services.logger.info('服务已就绪');
await services.logger.error(err, '结账失败');
await services.logger.fatal(err, '数据库不可用，准备退出');
```

## 先選出口

| 出口 | 包 | 什麼時候用 |
| --- | --- | --- |
| [ConsoleTransport](#consoletransport) | `@aomex/logger` | 本地開發、容器 stdout |
| [FileTransport](#filetransport) | `@aomex/logger` | 落盤、按日/等級分檔案 |
| [StreamTransport](#streamtransport) | `@aomex/logger` | 寫任意 Writable（測試、管道） |
| [WebhookTransport](#webhooktransport) | `@aomex/logger` | 推到自定義 HTTP 鉤子 |
| [CustomTransport](#customtransport) | `@aomex/logger` | 自建佇列 / DB / 廠商 SDK |
| [SentryTransport](#sentrytransport) | `@aomex/logger-sentry` | error 進 Sentry |
| [TelegramTransport](#telegramtransport) | `@aomex/logger-telegram` | fatal 叫醒人 |

生產常見組合：控制台 info + 檔案 warn + Sentry error + Telegram fatal。每個出口自己設 level，別一個通道扛全部噪音。下面按出口講怎麼配。

---

### ConsoleTransport

打到終端。TTY 下 text 預設著色；採集管道要 NDJSON 時改 `format: 'json'`，並關掉著色。

```typescript
{ transport: new ConsoleTransport(), level: 'debug' },
```

```typescript
new ConsoleTransport({
  format: 'json',
  colorize: false,
});
```

未設 `output` 時，error / fatal 預設進 stderr，其餘進 stdout；要全部進同一流時再設 `output`。`colors` 可改等級配色。

### FileTransport

追加寫本地檔案；目錄不存在會自動建。固定路徑夠用就一行；要按日 / 等級分檔案，用 `{year}` / `{month}` / `{day}` / `{level}` 佔位（也可 `(log) => path`）。

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

給 Fluent Bit 等轉發時用 `format: 'json'`。要收緊許可權再動 `fileMode` / `dirMode`。

### StreamTransport

寫任意 Writable（單元測試假流、程序管道）：

```typescript
new StreamTransport({
  stream: process.stdout,
  format: 'json',
});
```

`stream` 必填；`format` 預設 text。

### WebhookTransport

HTTP 推到告警 / 自建收集端點。慢鉤子可把 `timeoutMs` 調大（預設約 `30000`）；鑑權走 `headers`。

```typescript
new WebhookTransport({
  url: process.env.ALERT_WEBHOOK_URL!, // [!code highlight]
  headers: { Authorization: `Bearer ${process.env.HOOK_TOKEN}` },
  format: 'json',
});
```

`format` 也可是函式，自己拼 body。method 預設 POST。

### CustomTransport

自建消費邏輯；this 上可調 formatLog。

```typescript
new CustomTransport({
  async consume(log) { // [!code highlight]
    await myQueue.push(this.formatLog(log, 'json'));
  },
});
```

單條失敗一般不堵其它出口。需要更細控制時可繼承 Transport。

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

DSN 走環境變數，別寫進倉庫。level 建議至少 error，別把 info 灌進 Sentry。關停前等上報可用 `flushTimeout`（預設約 `2000`）。

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

適合「程序要掛了再叫人」；別綁一大堆 warn。間隔內同指紋會合並（`dedupe`，約 30s；設 `false` 關閉）。`timeout` 含自動重試，預設約 `120000`。

## 多出口組合

把上面拼進一個 Service，按等級分流：

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

也可以只要檔案、交給 Fluent Bit 等轉發——應用側更瘦。

## 請求級上下文：withBindings

排查時要「這條日誌屬於哪個請求」：在 Web mount 靠前包住 next()，下游日誌自動帶欄位。

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

鑑權後再補 userId（與外層合併，同名鍵內層覆蓋）：

```typescript
await ctx.logger.withBindings({ userId: ctx.auth.bearer.data.id }, next);
```

Console / Cron 裡對 services.logger.withBindings 同樣適用。關停或測試結束前可 await services.logger.flush()。

::: warning
withBindings 必須把 await next() 包在回撥裡，否則下游日誌可能不在同一上下文。
:::

## 相關

- [服務層](/zh-TW/core/service)
- [中介軟體](/zh-TW/core/middleware)
- [訪問日誌](/zh-TW/plugins/http-access-log)（HTTP 一行耗時，和分級出口互補）
