---
outline: deep
---

# Input options

Turn terminal flags like `--page 1` and `-d 2024-01-01` into **ctx.options** with the same `rule`s as Web. Validation failure → **non-zero exit**; `docs` feed into `--help`. argv is a flat string channel—prefer flat fields over nested structures.

```typescript
import { rule } from '@aomex/common';
import { Commander, options } from '@aomex/console';

const commander = new Commander();

commander.create('export', {
  mount: [
    options( // [!code highlight]
      {
        out: rule.string().docs({ description: 'Output path' }),
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

Two arguments: **field table** + optional **alias table**:

```typescript
options(
  fields: { [key: string]: Validator },
  aliasList?: { [key in keyof fields]?: string | string[] },
)
```

`ctx.options` mirrors the field table: `limit` is `number` (not string), `verbose` is `boolean`, `date` is `Date` after validation. Aliases expand **before** validation; short and long flags write the same field.

Do not hand-parse `process.argv` in the action—you lose types and consistent non-zero exits.

## migrate and dry-run

Migrations and batch jobs often need direction, step count, or dry-run switches. Declare them with `rule.boolean()` / `rule.enum()` in `options` so manual runs and CI share `--dry-run`; validation failure exits non-zero instead of parsing strings in the action.

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

## Shared with Cron

Cron injects args that go through the same `options()` validation as the CLI. Field names and types must match `aomex export --out ...` or the schedule reaches the action then dies at validation.

Cron args must satisfy the same rules—or “invalid cron args in prod”:

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
Cron `args` field names must match `options`, or the job fires then fails validation. Prefer flat fields over one string + manual `JSON.parse`—bad for help and validation.
:::

In prod / CI, cron-injected args use the same option names as manual scripts. Locally lean on `--help` to align fields; on failure read exit code and validation messages.

## Next steps

- Command layout: [Command routing](/en/console/commander)
- Rule chains: [Common chains](/en/validators/chain), [Validators overview](/en/validators/)
- Scheduled args: [Cron](/en/plugins/cron)