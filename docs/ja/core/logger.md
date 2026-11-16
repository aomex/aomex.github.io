---
outline: deep
---

# ログ

**LoggerService** を作り、`createTransports` で出力先を宣言。`combineServices` に登録し **eager でウォームアップ**。Web / Console が同じ `services.logger` を共有し、WebApp 必須の logger を満たす。

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
WebApp は services に加え `logger: services.logger` を別途渡す（同一参照でよい）：

```typescript
new WebApp({
  services,
  logger: services.logger, // [!code highlight]
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```
## レベルとシグネチャ

各ログ行に **level**：うるささは trace から fatal へ増加。トランスポートの level が「どこまで通すか」を決める。署名では error / fatal の第一引数は `Error`、他は多く `(message, context?)`。

- trace / debug / info / warn：`(message, context?)`
- error / fatal：`(err, message, context?)`
- 各出口の level は単一レベルか `{ min, max }` 範囲

うるさい順：trace → debug → info → warn → error → fatal。

::: warning
本番で debug / trace を長期 ON にするとホットパスもディスクも辛い。業務失敗は error。fatal はプロセス不健全用。全部 fatal にしない。
:::

```typescript
await services.logger.info('服务已就绪');
await services.logger.error(err, '结账失败');
await services.logger.fatal(err, '数据库不可用，准备退出');
```
## トランスポート一覧

| トランスポート | パッケージ | いつ使うか |
| --- | --- | --- |
| [ConsoleTransport](#consoletransport) | `@aomex/logger` | ローカル開発、コンテナ stdout |
| [FileTransport](#filetransport) | `@aomex/logger` | ローカルファイル、日付・レベル分割 |
| [StreamTransport](#streamtransport) | `@aomex/logger` | 任意 Writable（テスト、パイプ） |
| [WebhookTransport](#webhooktransport) | `@aomex/logger` | カスタム HTTP フックへ POST |
| [CustomTransport](#customtransport) | `@aomex/logger` | 自前キュー / DB / ベンダー SDK |
| [SentryTransport](#sentrytransport) | `@aomex/logger-sentry` | error を Sentry へ |
| [TelegramTransport](#telegramtransport) | `@aomex/logger-telegram` | fatal で人を起こす |

よくある本番組み合わせ：コンソール info + ファイル warn + Sentry error + Telegram fatal。各出口に独自 level。1チャネルに全ノイズを載せない。

---

### ConsoleTransport

ターミナルへ。TTY では text がデフォルト着色。収集パイプでは json に。

```typescript
{ transport: new ConsoleTransport(), level: 'debug' },
```

```typescript
new ConsoleTransport({
  format: 'json',
  colorize: false,
});
```
| オプション | いつ使うか | デフォルト |
| --- | --- | --- |
| `format` | 収集が NDJSON なら `'json'` | `'text'` |
| `colorize` | 着色の強制 ON/OFF | text かつ TTY で ON |
| `colors` | レベル別色 | 内蔵 |
| `output` | 全レベルを同一ストリームへ | — |
| `stderrLevels` | `output` 未設定時に stderr へ行くレベル | `error` / `fatal` |

### FileTransport

ローカルファイルへ追記。ディレクトリが無ければ自動作成。

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
| オプション | いつ使うか | デフォルト |
| --- | --- | --- |
| `file` | 固定パス、または `{year}`/`{level}` プレースホルダ；`(log) => path` も可 | 日付+レベル分割 |
| `format` | Fluent Bit など向けに `'json'` | `'text'` |
| `fileMode` / `dirMode` | 権限を絞るとき | システムデフォルト |

### StreamTransport

任意 Writable へ（単体テストの偽ストリーム、パイプ）。

```typescript
new StreamTransport({
  stream: process.stdout,
  format: 'json',
});
```
| オプション | いつ使うか |
| --- | --- |
| `stream` | 必須、宛先 Writable |
| `format` | `'text'` / `'json'`、デフォルト text |

### WebhookTransport

HTTP でアラート / 自前収集エンドポイントへ。

```typescript
new WebhookTransport({
  url: process.env.ALERT_WEBHOOK_URL!, // [!code highlight]
  headers: { Authorization: `Bearer ${process.env.HOOK_TOKEN}` },
  format: 'json',
});
```
| オプション | いつ使うか | デフォルト |
| --- | --- | --- |
| `url` | 必須、フック URL | — |
| `method` | POST 以外 | `POST` |
| `headers` | 認証、カスタムヘッダ | — |
| `format` | `'json'` / `'text'`、または body 組み立て関数 | `'json'` |
| `timeoutMs` | 遅いフック | `30000` |

### CustomTransport

独自消費ロジック。`this` 上で `formatLog` 可。

```typescript
new CustomTransport({
  async consume(log) { // [!code highlight]
    await myQueue.push(this.formatLog(log, 'json'));
  },
});
```
1件の失敗で他出口を止めないのが普通。より細かく制御するなら Transport を継承。

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
| オプション | いつ使うか | デフォルト |
| --- | --- | --- |
| `dsn` | 必須。構築時に `Sentry.init` | — |
| `flushTimeout` | 停止前の送信待ち | `2000` |

DSN は環境変数へ。リポジトリに書かない。level は少なくとも error。info を Sentry に流し込まない。

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
| オプション | いつ使うか | デフォルト |
| --- | --- | --- |
| `botToken` / `chatId` | 必須。BotFather / グループ id | — |
| `timeout` | 自動リトライ込みの総タイムアウト | `120000` |
| `format` | メッセージ本文カスタム | 内蔵 |
| `dedupe` | 間隔内で同一 fingerprint をマージ。`false` で OFF | ON（約30s） |

「プロセスが死にそうなとき」向け。warn を大量に結びつけない。

## 複数トランスポートの組み合わせ

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
ファイルだけにして Fluent Bit などに任せる——アプリ側を薄くできる。

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
認証後に userId を足す（外側とマージ、同名キーは内側が勝つ）：

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
- [アクセスログ](/ja/plugins/http-access-log)（HTTP 1行レイテンシ。レベル別出口と補完関係）
