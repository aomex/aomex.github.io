---
outline: deep
---

# 輸入引數

把終端裡的 --page 1 -d 2024-01-01 收成 **ctx.options**，規則和 Web 同一套 rule。校驗失敗**非零退出**；docs 會進 --help。argv 是扁平字串通道，複雜結構優先拆成扁平欄位。

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

簽名記住兩個引數：**欄位表** + 可選**別名表**：

```typescript
options(
  fields: { [key: string]: Validator },
  aliasList?: { [key in keyof fields]?: string | string[] },
)
```

ctx.options 與欄位表一一對應：limit 是 number（不是字串），verbose 是 boolean，date 在校驗通過後是 Date。別名在校驗**前**展開，長短選項寫入同一欄位。

別在 action 裡手搓 process.argv——會失去型別與非零退出的一致性。

## migrate 與 dry-run

資料庫遷移、批處理指令碼常需要「方向、步數、只演練不寫入」這類開關。用 `rule.boolean()` / `rule.enum()` 宣告在 options 裡，手跑和 CI 傳同一套 `--dry-run`，校驗失敗直接非零退出，比 action 裡 parse 字串可靠。

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

## 與 Cron 共用

Cron 觸發時把引數拼進 `args`，會再走一遍與 CLI 相同的 options() 校驗。欄位名、型別必須和手敲 `aomex export --out ...` 一致，否則定時能跑到 action 門口卻在校驗層掛掉。

定時 args 必須吃同一套規則——否則「線上定時引數不合法」：

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
Cron 的 args 裡欄位名必須和 options 一致，否則定時能觸發、一校驗就掛。複雜結構優先拆成扁平欄位，別塞進一個 string 再手動 JSON.parse——help 與校驗都不友好。
:::

生產 / CI 側：Cron 注入的 args 與手跑指令碼用同一套選項名。本地多用 --help 對齊欄位；失敗看退出碼與校驗文案。

## 下一步

- 指令組織：[指令路由](/zh-TW/console/commander)
- 規則鏈：[通用鏈式](/zh-TW/validators/chain)、[驗證器快速上手](/zh-TW/validators/)
- 定時引數：[Cron](/zh-TW/plugins/cron)