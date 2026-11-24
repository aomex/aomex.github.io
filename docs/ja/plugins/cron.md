---
outline: deep
---

# 定期実行 Cron

Console プロセスで既存の指令をスケジュール実行する。手打ちの aomex report:daily と定期トリガーは**同じ** action と options() を通る。crons() がスケジューラと管理口を起こし、cron() は具体指令の mount に計画を宣言する。複数レプリカでは共有 store が要る。さもないと重複トリガーになる。

```bash
pnpm add @aomex/cron
```

## ConsoleApp に crons()

`crons()` は Console プロセスでスケジューラを起こす。`commanders` ディレクトリ内の `cron()` 付き指令を掃き、時刻になると CLI と同じ経路で action を実行する。本機 HTTP の管理口も提供する（`port` 必須）。**Console にだけ載せる**。WebApp には載せない。

::: warning
`WebApp.mount` に載せると HTTP と定期タスク入口が混ざる。分けよ。
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

`commanders` は下の `commanders()` と**同じディレクトリ**にする。スケジューラが `cron()` を掃ける。`port` は本機の状態照会・停止用（有効範囲 1–65535）。

指令に計画を宣言する（[指令ルート](/ja/console/commander) と同じファイルでよい）：

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

文字列は `{ time: '...' }` と等価（5 段は分から、または 6 段で秒を含む）。フィールド組み合わせも可：`minute` / `hour` / `dayOfMonth` など。

実行：プロセスは常駐サービスとして動かすことが多い。同じ指令を aomex CLI だけで手実行して障害切り分けもできる。`crons()` は管理系サブコマンドも登録する（`cron:stats`、`cron:stop` など。パッケージ内の `--help` を正とする）。

## 長いタスクでの ctx.cron

定期トリガーの action と手実行 CLI は Console コンテキストを共有する。長く走るタスクでは **ctx.cron** が今回のスケジュール時刻と、用途の違う二種の生存判定を出す——場面ごとに**分けて使い**、一つのループ条件に無理に混ぜない。

- `scheduleTime` / `executionTime` / `nextScheduleTime`：ログ・監査用
- `isAlive()`：運用の停止指示に応じる
- `isCurrentEpoch()`：今回の時間窓がまだ切れていないか

### isAlive()：半永久ループは停止を聞く

キュー消費や外部状態のポーリングなど「誰かが止めるまで回る」ロジックは `while (ctx.cron.isAlive())`。運用が `cron:stop` を実行すると `false` になり、ループは抜けるべき。見ないと子プロセスが空回りし、手で殺すことになる。

```typescript
action: async (ctx) => {
  while (ctx.cron.isAlive()) { // [!code highlight]
    await drainQueue();
  }
};
```

### isCurrentEpoch()：今回の窓内で切り上げ

「次の計画トリガーまでに」終わらせたい一括処理（照合、表スキャン）は、各ステップの前に `isCurrentEpoch()` を見る。`true` の間は次のスケジュールがまだ来ていない。`false` になったら切り上げ、残りは次のラウンドへ。次の cron と重ならないようにする。

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

## 重なり防止と定期の引数

長いタスクのデフォルトは `concurrent: 1`：前ラウンドが終わっていないと、新しい時刻のトリガーは待機プールに入り、タイムアウト（デフォルト約 `10_000` ms、`waitingTimeout` で調整可）後に捨て、重なりを防ぐ。異なる時刻で重なりを許すなら `concurrent` を上げるか `'infinity'`。

定期実行で CLI 引数も付けるときは `args`——手打ちと同じ [options()](/ja/console/options) 検証をもう一度通る。フィールド名は揃える：

```typescript
import { cron } from '@aomex/cron';
import { options } from '@aomex/console';
import { rule } from '@aomex/common';

commander.create('export', {
  mount: [
    cron({ // [!code focus:8]
      time: '0 2 * * *',
      concurrent: 1,
      args: ['--out', '/data/nightly.csv', '--limit', '1000'],
    }),
    options({
      out: rule.string(),
      limit: rule.int().min(1).default(100),
    }),
  ],
  action: async (ctx) => {
    await exportCsv(ctx.options);
  },
});
```

## 複数レプリカは共有 store に替える

デフォルトの `store` は**プロセス内メモリ**：単機 Console なら足りる。複数 Pod / 複数マシンでは、各プロセスが時刻ごとに一度ずつ走る——日報が二通、照合が二回、はここから来る。

複数レプリカで動かしつつ、同じ計画がクラスタ全体で `concurrent` に従ってスロットを取るには、`crons()` に**共有 store**（よく使うのは Redis）を渡す。スケジュールと排他は store が調整する。業務 action に分散ロックを自分で足す必要はない。

```typescript
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

crons({
  commanders: './src/commanders',
  port: 9786,
  store: new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 }), // [!code highlight]
});
```

::: warning
複数レプリカでデフォルトのメモリ store のままだと、同じ cron が**各**レプリカで一度ずつトリガーされる。ローカル単プロセスに Redis は不要。
:::

| 方式 | いつ使う |
| --- | --- |
| プロセス内 `@aomex/cron` | `options()` と共用し、排他と管理口が要るとき |
| システム crontab で `aomex xxx` | 極簡の定期、プロセス内ロックが無くてよいとき |

## 次のステップ

- 指令とエイリアス：[指令ルート](/ja/console/commander)
- CLI 引数：[入力パラメータ](/ja/console/options)
- Console 入口：[Console アプリ](/ja/console/)
