---
outline: deep
---

# ログ

`new Logger({ transports })` で出力先を宣言し、**同じインスタンス**を Web / Console / WebSocket の `logger` に渡します。初回ログ書き込みで遅延接続、シャットダウン時は内部 `registerLifecycle` で破棄されます。

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

業務コードは `import { logger } from '@/services/logger.service'` で十分。`ctx.logger` は**同一参照**で、**サードパーティ middleware** と **app 内 middleware** 向け（ctx しか取れないとき）；どちらも同じ出力です。

## レベルとシグネチャ

各ログに **level** があります。うるささは trace から fatal へ増え、各 transport の level が「どのレベルまでこの出口に通すか」を決めます。

- trace / debug / info：メッセージのみ `(message)`
- warn / error / fatal：`(message)`、または `(err)` / `(err, message)` — `err` は `unknown`（`catch` 値含む）、`exception` にシリアライズ
- 構造化フィールドは [withBindings](#リクエスト単位のコンテキストwithbindings) を使い、info の後ろにオブジェクトを足さない
- 各出口の level は単一レベル、または `{ min, max }` 区間

うるさい順：trace → debug → info → warn → error → fatal。

ログメソッドは**同期**（`void` を返す）。`await` 不要。プロセス終了前にキューを flush したいときだけ `await logger.flush()`。

::: warning
本番で debug / trace を常時 ON にするとホットパスとディスクを圧迫します。業務失敗は error、fatal はプロセス不健康用 — 全失敗を fatal にしない。フレームワークは **`NODE_ENV` で自動的にレベルを切らない** — 各 transport の `level` で絞る。
:::

```typescript
import { logger } from '@/services/logger.service';

logger.info('服务已就绪');
logger.error(err, '结账失败');
logger.fatal(err, '数据库不可用，准备退出');
```

## 出口を選ぶ

| 出口 | パッケージ | いつ使う |
| --- | --- | --- |
| [ConsoleTransport](#consoletransport) | `@aomex/logger` | ローカル開発、コンテナ stdout |
| [FileTransport](#filetransport) | `@aomex/logger` | ファイル、日付 / レベル分割 |
| [StreamTransport](#streamtransport) | `@aomex/logger` | 任意 Writable（テスト、パイプ） |
| [WebhookTransport](#webhooktransport) | `@aomex/logger` | カスタム HTTP フック |
| [CustomTransport](#customtransport) | `@aomex/logger` | 自前キュー / DB / ベンダ SDK |
| [SentryTransport](#sentrytransport) | `@aomex/logger-sentry` | error を Sentry へ |
| [TelegramTransport](#telegramtransport) | `@aomex/logger-telegram` | fatal でオペレータ通知 |

本番のよくある組み合わせ：コンソール info + ファイル warn + Sentry error + Telegram fatal。出口ごとに level を分け、1 チャネルに全部流さない。以下、出口別の設定です。

---

### ConsoleTransport

ターミナルへ。TTY では text が既定で色付き。収集パイプで NDJSON が要るときは `format: 'json'` と着色オフ。

```typescript
{ transport: new ConsoleTransport(), level: 'debug' },
```

```typescript
new ConsoleTransport({
  format: 'json',
  colorize: false,
});
```

`output` 未設定時、error / fatal は stderr、他は stdout。全部同一ストリームにするなら `output` を設定。`colors` でレベル配色を変更可。

### FileTransport

ローカルファイルに追記。ディレクトリがなければ自動作成。固定パスで足りるなら 1 行。日付 / レベルで分けるなら `{year}` / `{month}` / `{day}` / `{level}` プレースホルダ（または `(log) => path`）。

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

Fluent Bit などへ転送するなら `format: 'json'`。権限を絞るなら `fileMode` / `dirMode`。

### StreamTransport

任意 Writable へ（テスト用フェイクストリーム、パイプ）：

```typescript
new StreamTransport({
  stream: process.stdout,
  format: 'json',
});
```

`stream` 必須；`format` 既定は text。

### WebhookTransport

HTTP でアラート / 自前収集エンドポイントへ。遅いフックは `timeoutMs` を大きく（既定約 `30000`）。認証は `headers`。

```typescript
new WebhookTransport({
  url: process.env.ALERT_WEBHOOK_URL!, // [!code highlight]
  headers: { Authorization: `Bearer ${process.env.HOOK_TOKEN}` },
  format: 'json',
});
```

`format` は関数でも可、body を自前組み立て。method 既定 POST。

### CustomTransport

自前の consume；`this` 上で `formatLog` 呼び出し可。

```typescript
new CustomTransport({
  async consume(log) { // [!code highlight]
    await myQueue.push(this.formatLog(log, 'json'));
  },
});
```

1 件失敗しても他出口は通常ブロックされません。細かく制御するなら Transport を継承。

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

DSN は環境変数、リポジトリに書かない。level は少なくとも error、info を Sentry に流さない。停止前の送信待ちは `flushTimeout`（既定約 `2000`）。

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

「プロセスが死にそうなときに人を起こす」向き；大量の warn は載せない。間隔内の同一フィンガープリントはマージ（`dedupe`、約 30s；`false` でオフ）。`timeout` は自動リトライ含み、既定約 `120000`。

## 複数出口の組み合わせ

上記を 1 つの `Logger` にまとめ、レベルで分流：

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

ファイルだけにして Fluent Bit 等に任せることも可 — アプリ側は薄く。一時的に某出口を止めるなら `disabled: true`（`onInit` / 投递 / `flush` なし）。

## リクエスト単位のコンテキスト：withBindings

調査で「このログがどのリクエストか」を付けたい：Web の mount の手前で `next()` を包み、下流ログにフィールドが自動で乗ります。

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

認証後に userId を追加（外側とマージ、同名キーは内側が優先）：

```typescript
await logger.withBindings({ userId: ctx.auth.bearer.data.id }, next);
```

Console / Cron も同じ `logger`。シャットダウンやテスト終了前に `await logger.flush()`。

::: warning
withBindings ではコールバック内で `await next()` を包むこと。さもないと下流ログが同じコンテキストに入らないことがあります。
:::

## 関連

- [サービス層](/ja/core/service)
- [ミドルウェア](/ja/core/middleware)
- [アクセスログ](/ja/plugins/access-log)（HTTP 1 行レイテンシ、レベル分岐出口と補完）