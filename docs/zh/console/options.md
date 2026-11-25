---
outline: deep
---

# 输入参数

把终端里的 --page 1 -d 2024-01-01 收成 **ctx.options**，规则和 Web 同一套 rule。校验失败**非零退出**；docs 会进 --help。argv 是扁平字符串通道，复杂结构优先拆成扁平字段。

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

签名记住两个参数：**字段表** + 可选**别名表**：

```typescript
options(
  fields: { [key: string]: Validator },
  aliasList?: { [key in keyof fields]?: string | string[] },
)
```

ctx.options 与字段表一一对应：limit 是 number（不是字符串），verbose 是 boolean，date 在校验通过后是 Date。别名在校验**前**展开，长短选项写入同一字段。

别在 action 里手搓 process.argv——会失去类型与非零退出的一致性。

## migrate 与 dry-run

数据库迁移、批处理脚本常需要「方向、步数、只演练不写入」这类开关。用 `rule.boolean()` / `rule.enum()` 声明在 options 里，手跑和 CI 传同一套 `--dry-run`，校验失败直接非零退出，比 action 里 parse 字符串可靠。

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

## 与 Cron 共用

Cron 触发时把参数拼进 `args`，会再走一遍与 CLI 相同的 options() 校验。字段名、类型必须和手敲 `aomex export --out ...` 一致，否则定时能跑到 action 门口却在校验层挂掉。

定时 args 必须吃同一套规则——否则「线上定时参数不合法」：

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
Cron 的 args 里字段名必须和 options 一致，否则定时能触发、一校验就挂。复杂结构优先拆成扁平字段，别塞进一个 string 再手动 JSON.parse——help 与校验都不友好。
:::

生产 / CI 侧：Cron 注入的 args 与手跑脚本用同一套选项名。本地多用 --help 对齐字段；失败看退出码与校验文案。

## 下一步

- 指令组织：[指令路由](/zh/console/commander)
- 规则链：[通用链式](/zh/validators/chain)、[验证器快速上手](/zh/validators/)
- 定时参数：[Cron](/zh/plugins/cron)