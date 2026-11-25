---
outline: deep
---

# Command routing

Define Console “verb phrase” commands (e.g. `cache:warm`), not HTTP method + path. Multiple commands can share one `Commander` and prefix—mirrors Web `Router` + `routers()`.

```typescript
import { logger } from '@/services/logger.service';

import { Commander, commanders, ConsoleApp, options } from '@aomex/console';
import { rule } from '@aomex/common';

export const commander = new Commander({
  prefix: 'cache:', // [!code highlight]
});

commander.create('warm', {
  docs: { summary: 'Warm cache' },
  mount: [
    options({
      key: rule.string().optional(),
    }),
  ],
  action: async (ctx) => {
    logger.info(`warming ${ctx.options.key ?? 'all'}`);
  },
});

commander.create(['flush', 'clear'], {
  action: async (ctx) => {
    logger.info('cache cleared');
  },
});

// ConsoleApp.mount
commanders('./src/commanders');
// or commanders([commander])
```

```bash
aomex cache:warm --key users
aomex cache:clear
```

With `options({ ... })`, `ctx.options` matches the field table (same `rule`s as Web query/body). Return values from `action` participate in exit semantics; async errors bubble as failure exit codes per framework rules.

`create` shape:

```typescript
commander.create(commandName | string[], {
  disabled?: boolean;
  mount?: ConsoleMiddleware[];
  docs?: { summary?: string; description?: string };
  action: (ctx) => any;
});
```

Command names concatenate with constructor `prefix`; `disabled: true` skips registration—handy for env-gated rollback.

## prefix

`prefix` is the command name prefix: `new Commander({ prefix: 'cache:' })` + `create('warm')` → `aomex cache:warm`. Domain prefixes (`cache:`, `user:`) reduce cross-file collisions and group related commands in `--help`.

Unmatched commands usually exit **non-zero** and print help—assert exit codes in CI, not only stdout. Forgetting `commanders(...)` on `ConsoleApp.mount` means defined commands never appear in the CLI.

## Registering with `commanders`

| Pattern | Notes |
| --- | --- |
| `commanders('./dir')` | Directory as registry—fewer imports |
| `commanders([a, b])` | Tests or subset mounting |
| One domain per file | `cache.commander.ts`, `user.commander.ts` |
| Shared with Cron | Schedule and manual runs share file and `action`; Cron `args` must pass the same `options()`—see [Cron](/en/plugins/cron) |
| OpenAPI export | Mount `openapi()` with `commanders()` on Console—see [Generate OpenAPI](/en/openapi/) |

## docs and disabled

`docs` feed `--help` summaries; complement `options` field `docs`. Use a command name array (`flush` / `clear`) when old and new script names coexist.

Feature flags:

```typescript
commander.create('sync', {
  disabled: process.env['FEATURE_SYNC'] !== '1', // [!code highlight]
  action: async (ctx) => {
    await runSync();
  },
});
```

## Next steps

- Option validation: [Input options](/en/console/options)
- Scheduling: [Cron](/en/plugins/cron)
- Entry and exit codes: [Console app](/en/console/)