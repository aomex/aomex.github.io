---
outline: deep
---

# 入力パラメータ

ターミナルの `--page 1`、`-d 2024-01-01` を **ctx.options** に収めます。ルールは Web と同じ rule。検証失敗は**非ゼロ終了**；docs は `--help` に入ります。argv はフラットな文字列チャネルなので、複雑な構造はフラットなフィールドに拆すのがよいです。

```typescript
import { logger } from '@/services/logger.service';

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
      logger.info(`export start out=${out} date=${date} limit=${limit}`);
    }
    await exportCsv({ out, date, limit });
  },
});
```

```bash
aomex export --out ./a.csv -d 2024-01-01 --limit 50 -v
aomex export --help
```

署名は 2 引数：**フィールド表** + 任意の**エイリアス表**：

```typescript
options(
  fields: { [key: string]: Validator },
  aliasList?: { [key in keyof fields]?: string | string[] },
)
```

`ctx.options` はフィールド表と 1 対 1：`limit` は number（文字列ではない）、`verbose` は boolean、検証後 `date` は Date。エイリアスは検証**前**に展開し、長短オプションは同一フィールドへ。

action 内で `process.argv` を手揉みしない — 型と非ゼロ終了の一貫性を失います。

## migrate と dry-run

DB マイグレーションやバッチで「方向・ステップ・書き込みなし演習」が要ることが多いです。`rule.boolean()` / `rule.enum()` を options に宣言し、手動も CI も同じ `--dry-run` — 検証失敗ですぐ非ゼロ終了。action 内で文字列 parse するより堅いです。

```typescript
import { logger } from '@/services/logger.service';

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
      logger.info(`dry-run direction=${direction} steps=${steps ?? ''}`);
      return;
    }
    await runMigrate({ direction, steps });
  },
});
```

## Cron と共用

Cron 発火時は `args` にパラメータが連結され、CLI と同じ `options()` 検証を再度通ります。フィールド名・型は手打ち `aomex export --out ...` と一致させないと、定期実行は action 手前まで来て検証で落ちます。

Cron の args は同じルールセット必須 — そうでないと「本番の cron 引数が不正」になります：

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
Cron の args のフィールド名は options と一致必須。一致しないとトリガーは走るが検証で落ちる。複雑構造はフラットに拆し、1 本の string に JSON を詰めて手 parse しない — help も検証も不利です。
:::

本番 / CI：Cron 注入の args と手動スクリプトは同じオプション名。ローカルは `--help` でフィールドを揃える。失敗は終了コードと検証メッセージを見る。

## 次のステップ

- コマンド構成：[コマンドルーティング](/ja/console/commander)
- ルールチェーン：[共通チェーン](/ja/validators/chain)、[バリデータクイックスタート](/ja/validators/)
- スケジュール引数：[Cron](/ja/plugins/cron)