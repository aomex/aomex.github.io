---
outline: deep
---

# 定期実行 Cron

Console プロセスで既存コマンドをスケジュール実行。手で aomex report:daily を叩くのと定期トリガーは**同じ** action と options()。crons() がスケジューラと管理口を起動。cron() は各コマンドの mount で計画を宣言。複数レプリカは共有 store が必要でないと重複実行。

```bash
pnpm add @aomex/cron
```

## ConsoleApp に crons()

`crons()` は Console でスケジューラ起動：`commanders` ディレクトリの `cron()` 付きコマンドを走査し、時刻に CLI と同じ経路で action 実行。ローカル HTTP 管理口も提供（port 変更可）。**Console のみ**。**WebApp に載せない**。

::: warning
`WebApp.mount` に載せると HTTP と定期タスク入口が混ざる。分離すること。

:::

```typescript
import { commanders, ConsoleApp } from '@aomex/console';
import { crons } from '@aomex/cron';

const app = new ConsoleApp({
  services,
  logger: services.logger,
  language: 'zh-CN',
  mount: [ // [!code focus:7]
    crons({
      commanders: './src/commanders', // [!code highlight]
      port: 9786,
    }),
    commanders('./src/commanders'),
  ],
});
```

コマンドで計画宣言（[コマンドルーティング](/ja/console/commander) と同ファイルで可）：

```typescript
import { Commander } from '@aomex/console';
import { cron } from '@aomex/cron';

export const commander = new Commander();

commander.create('report:daily', { // [!code focus:6]
  mount: [cron('0 9 * * *')], // [!code highlight]
  action: async (ctx) => {
    await sendReport();
  },
});
```

運用：プロセスは常駐サービスが多い。aomex CLI で同コマンドを手実行して障害切り分けも可。

## 長いタスクでの ctx.cron

定期トリガーの action と手 CLI は Console コンテキストを共有。長時間タスクでは **ctx.cron** が今回のスケジュール時刻と、用途の異なる二種類の生存判定——シーンごと**分けて**使い、一つのループ条件に無理にまとめない。

- `scheduleTime` / `executionTime` / `nextScheduleTime`：ログ・監査
- `isAlive()`：運用停止に応答
- `isCurrentEpoch()`：今回の時間窗がまだ有効か

`crons()` は管理系サブコマンド（`cron:stats`、`cron:stop` 等、パッケージ `--help` 準拠）も登録。

### isAlive()：半永久ループは停止を聞く

キュー消費、外部状態ポーリングなど「止められるまで回す」ロジックは `while (ctx.cron.isAlive())`。運用が `cron:stop` すると false になりループ終了。見ないと子プロセスが手動 kill まで空転。

```typescript
action: async (ctx) => {
  while (ctx.cron.isAlive()) { // [!code highlight]
    await drainQueue();
  }
};
```

### isCurrentEpoch()：今回の窗内で切り上げ

「次の計画トリガー前に」終える仕事（照合、テーブルスキャン）は各ステップで `isCurrentEpoch()`。true なら次回スケジュール前。false なら切り上げ残りは次ラウンドへ。次の cron と重ならない。

```typescript
action: async (ctx) => {
  for (const chunk of chunks) {
    if (!ctx.cron.isCurrentEpoch()) { // [!code highlight]
      break;
    }
    await processChunk(chunk);
  }
};
```

## crons() アプリレベルフィールド

| フィールド | いつ使う | デフォルト |
| --- | --- | --- |
| `commanders` | `commanders()` と同ディレクトリ。スケジューラが `cron()` を見つける | — |
| `port` | ローカル HTTP 管理 / 状態 | パッケージ既定 |
| `store` | **複数マシンでは必須** Redis 等 | メモリ（当該プロセスのみ） |

## cron() 単一コマンドフィールド

| フィールド | いつ使う | デフォルト |
| --- | --- | --- |
| `time` / `second`…`minute` | 5/6 フィールド式またはフィールド組み合わせ | — |
| `args` | 定期実行時に自動付与する CLI 引数 | — |
| `concurrent` | 重複防止。長いタスクは `1` が多い | `1` |
| `waitingTimeout` | 並列満杯時にスロット待ち時間 | `10_000` |

文字列書式は { time: '...' } と同等：

```typescript
cron({
  time: '0 9 * * *', // [!code highlight]
  concurrent: 1,
  args: ['--verbose'],
});
```

### 分散タスク

既定 `store` は**プロセス内メモリ**：単一 Console で足りる。複数 Pod / 複数マシンでは各プロセスが同時刻に実行——日報が二通、照合が二回の原因。

複数レプリカで同一計画をクラスタ全体で `concurrent` スロット競争させるには `crons()` に**共有 store**（Redis が一般的）。スケジュールと排他は store が調整。業務 action に分散ロックは不要。

```typescript
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

crons({
  commanders: './src/commanders',
  port: 9786,
  store: new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 }), // [!code highlight]
});
```

::: warning
複数レプリカで既定メモリ store のままだと、同一 cron が**各**レプリカで一度ずつ発火。ローカル単一プロセスなら Redis 不要。

:::

| 方式 | いつ使う |
| --- | --- |
| プロセス内 `@aomex/cron` | `options()` と共有、排他と管理口が要る |
| システム crontab で `aomex xxx` | 極小の定期、プロセス内ロックなしでも可 |

`cron()` の args は argv 注入。[入力パラメータ](/ja/console/options) の options() フィールドと一致させる。

## 次のステップ

- コマンドとエイリアス：[コマンドルーティング](/ja/console/commander)
- CLI 引数：[入力パラメータ](/ja/console/options)
- Console 入口：[Console アプリ](/ja/console/)