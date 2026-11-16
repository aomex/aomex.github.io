---
outline: deep
---

# 로거

**LoggerService**를 만들고 `createTransports`에 sink를 선언합니다. `combineServices`에 등록하고 **eager** 예열. Web / Console이 같은 `services.logger`를 쓰며 WebApp 필수 `logger`를 만족합니다.

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

WebApp은 `services` 외에 `logger: services.logger`(같은 참조)도 넘깁니다:

```typescript
new WebApp({
  services,
  logger: services.logger, // [!code highlight]
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

## 레벨과 서명

로그마다 **level**이 있고 trace부터 fatal까지 소음이 커집니다. sink `level`이 통과 기준입니다. `error` / `fatal` 첫 인자는 `Error`, 나머지는 보통 `(message, context?)`.

- trace / debug / info / warn: `(message, context?)`
- error / fatal: `(err, message, context?)`
- sink `level`은 단일 레벨 또는 `{ min, max }`

시끄러운→조용: trace → debug → info → warn → error → fatal.

::: warning
프로덕션에서 debug/trace 장기 ON은 핫 경로·디스크에 부담. 비즈니스 실패는 `error`, 프로세스 불건은 `fatal` — 모든 실패를 fatal로 쓰지 마세요.
:::

```typescript
await services.logger.info('服务已就绪');
await services.logger.error(err, '结账失败');
await services.logger.fatal(err, '数据库不可用，准备退出');
```

## sink 목록

| sink | 패키지 | 언제 |
| --- | --- | --- |
| [ConsoleTransport](#consoletransport) | `@aomex/logger` | 로컬, 컨테이너 stdout |
| [FileTransport](#filetransport) | `@aomex/logger` | 파일, 일/레벨 분리 |
| [StreamTransport](#streamtransport) | `@aomex/logger` | Writable(테스트, 파이프) |
| [WebhookTransport](#webhooktransport) | `@aomex/logger` | 커스텀 HTTP 훅 |
| [CustomTransport](#customtransport) | `@aomex/logger` | 큐 / DB / 벤더 SDK |
| [SentryTransport](#sentrytransport) | `@aomex/logger-sentry` | error → Sentry |
| [TelegramTransport](#telegramtransport) | `@aomex/logger-telegram` | fatal 알림 |

흔한 프로덕션: console info + file warn + Sentry error + Telegram fatal. sink마다 level을 나누세요.

---

### ConsoleTransport

터미널 출력. TTY+`text`는 기본 색; 파이프라인은 `json`.

```typescript
{ transport: new ConsoleTransport(), level: 'debug' },
```

```typescript
new ConsoleTransport({
  format: 'json',
  colorize: false,
});
```

| 옵션 | 언제 | 기본 |
| --- | --- | --- |
| `format` | NDJSON 수집 시 `'json'` | `'text'` |
| `colorize` | 색 강제 on/off | text+TTY 시 on |
| `colors` | 레벨 색 | 내장 |
| `output` | 모든 레벨 한 스트림 | — |
| `stderrLevels` | `output` 없을 때 stderr | `error` / `fatal` |

### FileTransport

로컬 파일 append; 디렉터리 자동 생성.

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

| 옵션 | 언제 | 기본 |
| --- | --- | --- |
| `file` | 고정 경로, `{year}`/`{level}` placeholder, 또는 `(log) => path` | 일+레벨 분리 |
| `format` | Fluent Bit 등 `'json'` | `'text'` |
| `fileMode` / `dirMode` | 권한 조정 | OS 기본 |

### StreamTransport

임의 Writable(테스트 더블, 파이프).

```typescript
new StreamTransport({
  stream: process.stdout,
  format: 'json',
});
```

| 옵션 | 언제 |
| --- | --- |
| `stream` | 필수 Writable |
| `format` | `'text'` / `'json'`, 기본 text |

### WebhookTransport

HTTP로 알림·수집 엔드포인트.

```typescript
new WebhookTransport({
  url: process.env.ALERT_WEBHOOK_URL!, // [!code highlight]
  headers: { Authorization: `Bearer ${process.env.HOOK_TOKEN}` },
  format: 'json',
});
```

| 옵션 | 언제 | 기본 |
| --- | --- | --- |
| `url` | 필수 URL | — |
| `method` | POST 아닐 때 | `POST` |
| `headers` | 인증·커스텀 헤더 | — |
| `format` | `'json'` / `'text'` 또는 함수 | `'json'` |
| `timeoutMs` | 느린 훅 | `30000` |

### CustomTransport

커스텀 consume; `this.formatLog` 사용.

```typescript
new CustomTransport({
  async consume(log) { // [!code highlight]
    await myQueue.push(this.formatLog(log, 'json'));
  },
});
```

한 sink 실패가 보통 다른 sink를 막지 않음. 더 세밀하면 Transport 상속.

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

| 옵션 | 언제 | 기본 |
| --- | --- | --- |
| `dsn` | 필수; `Sentry.init` | — |
| `flushTimeout` | 종료 전 flush 대기 | `2000` |

DSN은 env, 커밋 금지. level은 error 이상, info로 Sentry를 채우지 마세요.

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

| 옵션 | 언제 | 기본 |
| --- | --- | --- |
| `botToken` / `chatId` | BotFather / 채팅 id | — |
| `timeout` | 재시도 포함 총 타임아웃 | `120000` |
| `format` | 메시지 본문 커스텀 | 내장 |
| `dedupe` | fingerprint 윈도 병합; `false` 끔 | on(~30s) |

프로세스가 죽을 때 깨우기용 — warn 전부 묶지 마세요.

## 다중 sink

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

파일만 두고 Fluent Bit 등에 넘겨도 됩니다 — 앱은 더 가볍습니다.

## 요청 스코프: withBindings

요청별로 로그 상관: Web `mount` 앞에서 `next()`를 감쌉니다.

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

인증 후 `userId` 추가(병합, 같은 키는 안쪽 우선):

```typescript
await ctx.logger.withBindings({ userId: ctx.auth.bearer.data.id }, next);
```

Console / Cron에서도 `services.logger.withBindings` 동일. 종료·테스트 전 `await services.logger.flush()`.

::: warning
`withBindings`는 콜백에서 `await next()`를 감싸야 downstream 로그가 같은 컨텍스트입니다.
:::

## 관련

- [서비스](/ko/core/service)
- [미들웨어](/ko/core/middleware)
- [액세스 로그](/ko/plugins/http-access-log)(HTTP 한 줄 — 레벨 sink 보완)