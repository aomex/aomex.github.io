---
outline: deep
---

# ログ

**LoggerService** を一つ作り、createTransports でどこへ出すかを宣言する。combineServices に登録し **eager で事前ロード**する。Web / Console は同じ services.logger を共有し、WebApp 必須の logger も満たす。

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

WebApp は services のほかに、別途 `logger: services.logger` も渡す（同じ参照でよい）：

```typescript
new WebApp({
  services,
  logger: services.logger, // [!code highlight]
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

## レベルとシグネチャ

各ログに **level** が付く。うるささは trace から fatal へ増える。出口表の level が「どれだけうるさいものまでこの通路に入れるか」を決める。シグネチャ上、error / fatal の第 1 引数は `Error`。ほかのレベルはだいたい `(message, context?)`。

- trace / debug / info / warn：(message, context?)
- error / fatal：(err, message, context?)
- 各出口の level は単一レベル、または { min, max } 区間

レベルはうるさい方から静かへ：trace → debug → info → warn → error → fatal。

::: warning
本番で長く debug / trace をオンにするとホットパスもディスクも持たない。業務失敗は error。fatal はプロセスが不健康なとき。すべての失敗を fatal にしない。
:::

```typescript
await services.logger.info('服务已就绪');
await services.logger.error(err, '结账失败');
await services.logger.fatal(err, '数据库不可用，准备退出');
```

## 先に出口を選ぶ

| 出口 | パッケージ | いつ使う |
| --- | --- | --- |
| [ConsoleTransport](#consoletransport) | `@aomex/logger` | ローカル開発、コンテナ stdout |
| [FileTransport](#filetransport) | `@aomex/logger` | ディスク落とし、日 / レベルで分割 |
| [StreamTransport](#streamtransport) | `@aomex/logger` | 任意の Writable（テスト、パイプ） |
| [WebhookTransport](#webhooktransport) | `@aomex/logger` | カスタム HTTP フックへ |
| [CustomTransport](#customtransport) | `@aomex/logger` | 自前キュー / DB / ベンダー SDK |
| [SentryTransport](#sentrytransport) | `@aomex/logger-sentry` | error を Sentry へ |
| [TelegramTransport](#telegramtransport) | `@aomex/logger-telegram` | fatal で人を起こす |

本番のよくある組み合わせ：コンソール info + ファイル warn + Sentry error + Telegram fatal。出口ごとに level を自分で設定する。一つの通路にすべてのノイズを載せない。以下、出口ごとに配り方を述べる。

---

### ConsoleTransport

端末へ出す。TTY では text がデフォルトで色付き。収集パイプで NDJSON が要るときは `format: 'json'` にし、色を切る。

```typescript
{ transport: new ConsoleTransport(), level: 'debug' },
```

```typescript
new ConsoleTransport({
  format: 'json',
  colorize: false,
});
```

`output` 未設定時、error / fatal はデフォルト stderr、ほかは stdout。全部を同じストリームに入れるときだけ `output` を設定。`colors` でレベルの配色を変えられる。

### FileTransport

ローカルファイルへ追記。ディレクトリが無ければ自動作成。固定パスで足りるなら一行。日 / レベルで分割するなら `{year}` / `{month}` / `{day}` / `{level}` プレースホルダ（または `(log) => path`）。

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

Fluent Bit などへ転送するときは `format: 'json'`。権限を締めるなら `fileMode` / `dirMode`。

### StreamTransport

任意の Writable へ書く（単体テストの偽ストリーム、プロセスパイプ）：

```typescript
new StreamTransport({
  stream: process.stdout,
  format: 'json',
});
```

`stream` は必須。`format` デフォルトは text。

### WebhookTransport

HTTP でアラート / 自前収集エンドポイントへ送る。遅いフックは `timeoutMs` を上げる（デフォルト約 `30000`）。認証は `headers`。

```typescript
new WebhookTransport({
  url: process.env.ALERT_WEBHOOK_URL!, // [!code highlight]
  headers: { Authorization: `Bearer ${process.env.HOOK_TOKEN}` },
  format: 'json',
});
```

`format` は関数でもよく、自分で body を組み立てる。method デフォルトは POST。

### CustomTransport

自前の消費ロジック。this 上で formatLog を呼べる。

```typescript
new CustomTransport({
  async consume(log) { // [!code highlight]
    await myQueue.push(this.formatLog(log, 'json'));
  },
});
```

単一条の失敗は、だいたいほかの出口を塞がない。より細かい制御が要るときは Transport を継承する。

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

DSN は環境変数。リポジトリに書かない。level は少なくとも error。info を Sentry に流さない。シャットダウン前に報告待ちなら `flushTimeout`（デフォルト約 `2000`）。

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

「プロセスが落ちそうなとき人を起こす」向け。大量の warn を結ばない。間隔内の同じ指紋はまとめる（`dedupe`、約 30s。`false` でオフ）。`timeout` は自動リトライ込みでデフォルト約 `120000`。

## 複数出口の組み合わせ

上を一つの Service に組み、レベルで振り分ける：

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

ファイルだけにして Fluent Bit などに転送を任せることもできる——アプリ側はより細い。

## リクエスト単位のコンテキスト：withBindings

調査で「このログはどのリクエストか」：Web mount の手前で `next()` を包み、下流ログにフィールドを自動付与。

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

認証後に userId を足す（外層とマージ。同名キーは内層が上書き）：

```typescript
await ctx.logger.withBindings({ userId: ctx.auth.bearer.data.id }, next);
```

Console / Cron でも `services.logger.withBindings` は同様。停止やテスト終了前に `await services.logger.flush()` 可。

::: warning
`withBindings` はコールバック内で `await next()` を包むこと。さもないと下流ログが同じコンテキストに入らない。
:::

## 関連

- [サービス層](/ja/core/service)
- [ミドルウェア](/ja/core/middleware)
- [アクセスログ](/ja/plugins/access-log)（HTTP 一行の所要時間。レベル別出口と補完）
