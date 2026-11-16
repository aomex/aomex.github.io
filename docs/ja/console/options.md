---
outline: deep
---

# 入力パラメータ

ターミナルの `--page 1`、`-d 2024-01-01` を **`ctx.options`** に集約。ルールは Web と同じ rule 系。検証失敗は**非ゼロ終了**。docs は `--help` に入る。argv は平坦な文字列チャネル。複雑な構造は平坦フィールドに分割するのが無難。

```typescript
import { rule } from '@aomex/common';
import { Commander, options } from '@aomex/console';

const commander = new Commander();

commander.create('export', {
  mount: [
    options( // [!code highlight]
      {
        out: rule.string().docs({ description: '输出路径' }),
        date: rule.date('yyyy-MM-dd').optional(),
        limit: rule.int().min(1).default(100),
        verbose: rule.boolean().default(false),
      },
      {
        out: ['o'],
        date: ['d'],
        verbose: ['v'],
      },
    ),
  ],
  action: async (ctx) => {
    const { out, date, limit, verbose } = ctx.options;
    if (verbose) {
      await ctx.logger.info('export start', { out, date, limit });
    }
    await exportCsv({ out, date, limit });
  },
});
```

```bash
aomex export --out ./a.csv -d 2024-01-01 --limit 50 -v
aomex export --help
```
署名は二つ覚える：**フィールド表** + 任意の**エイリアス表**：

```typescript
options(
  fields: { [key: string]: Validator },
  aliasList?: { [key in keyof fields]?: string | string[] },
)
```
`ctx.options` はフィールド表と1対1。`limit` は number（文字列ではない）、`verbose` は boolean、`date` は検証後 Date。エイリアスは検証**前**に展開し、長短オプションは同一フィールドへ。

action で `process.argv` を手作業しない——型と非ゼロ終了の一貫性を失う。

## migrate と dry-run

DB マイグレーションやバッチで「方向、ステップ数、書き込まない演習」が要る。`rule.boolean()` / `rule.enum()` を options に宣言し、手動も CI も同じ `--dry-run` を渡す。検証失敗は即非ゼロ。action 内 parse より信頼できる。

```typescript
commander.create('migrate', {
  mount: [
    options({ // [!code highlight]
      direction: rule.enum(['up', 'down'] as const).default('up'),
      steps: rule.int().min(1).optional(),
      dryRun: rule.boolean().default(false),
    }),
  ],
  action: async (ctx) => {
    const { direction, steps, dryRun } = ctx.options;
    if (dryRun) {
      await ctx.logger.info('dry-run', { direction, steps });
      return;
    }
    await runMigrate({ direction, steps });
  },
});
```
## Cron と共有

Cron 発火時は `args` にパラメータを詰め、CLI と同じ `options()` 検証を再度通る。フィールド名・型は手打ち `aomex export --out ...` と一致させる。さもないと定時は action 手前まで来て検証で落ちる。

Cron の args は同じルールセット必須——さもないと「本番の定時引数が不正」：

```typescript
import { cron } from '@aomex/cron';

commander.create('export', {
  mount: [
    cron({ // [!code highlight]
      time: '0 2 * * *',
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
::: warning
Cron の `args` のフィールド名は `options` と一致。さもないと発火はするが検証で即死。複雑構造は1 string に JSON を押し込まず平坦化——help と検証が両方つらくなる。
:::

本番 / CI：Cron 注入の args と手動スクリプトでオプション名を統一。ローカルは `--help` でフィールドを揃える。失敗は終了コードと検証メッセージを見る。

## 次のステップ

- コマンド構成：[コマンドルーティング](/ja/console/commander)
- ルールチェーン：[共通チェーン](/ja/validators/chain)、[バリデータ入門](/ja/validators/)
- 定時パラメータ：[Cron](/ja/plugins/cron)
