---
outline: deep
---

# Cron Jobs

Run existing commands on a schedule inside a Console process: typing `aomex report:daily` by hand and a timed trigger share the **same** action and options(). `crons()` starts the scheduler and control port; `cron()` on a command’s mount declares the schedule. Multiple replicas need a shared store, or jobs will fire more than once.

```bash
pnpm add @aomex/cron
```

## Mount crons() on ConsoleApp

`crons()` starts a scheduler in the Console process: it scans the `commanders` directory for commands with `cron()`, and at the scheduled time runs the action via the same path as the CLI. It also exposes a local HTTP control port (`port` is required). **Mount on Console only**—not on WebApp.

::: warning
Mounting on `WebApp.mount` mixes HTTP and scheduled-job entry points; keep them separate.
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

`commanders` must be the **same directory** as `commanders()` below so the scheduler can find `cron()`. `port` is for local status checks and stopping jobs (valid range 1–65535).

Declare the schedule on the command (same file as [command routing](/en/console/commander) is fine):

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

A string is equivalent to `{ time: '...' }` (five fields starting at minute, or six including seconds). You can also compose fields: `minute` / `hour` / `dayOfMonth`, and so on.

Run it: keep the process as a long-running service; you can also run the same command by hand with the aomex CLI for debugging. `crons()` also registers control subcommands (such as `cron:stats`, `cron:stop`, etc.—see `--help` in the package).

## Use ctx.cron in long jobs

Scheduled actions and hand-run CLI share the Console context. In long-running jobs, **ctx.cron** gives this round’s schedule times and two different kinds of liveness checks—use them **separately by scenario**, don’t mash them into one loop condition.

- `scheduleTime` / `executionTime` / `nextScheduleTime`: logging and audit
- `isAlive()`: respond to ops stop signals
- `isCurrentEpoch()`: whether this round’s time window has expired

### isAlive(): long-lived loops must honor stop

For queue consumers or polling external state—“keep going until someone says stop”—use `while (ctx.cron.isAlive())`. After ops runs `cron:stop` it becomes `false` and the loop should exit; if you don’t check, the child process may spin until you kill it manually.

```typescript
action: async (ctx) => {
  while (ctx.cron.isAlive()) { // [!code highlight]
    await drainQueue();
  }
};
```

### isCurrentEpoch(): finish within this round’s window

For work that should wrap up before the next scheduled fire (reconciliation, table scans), check `isCurrentEpoch()` before each step: still `true` means the next schedule hasn’t arrived; when it becomes `false`, stop and leave the rest for the next round so you don’t overlap the next cron run.

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

## Overlap control and scheduled args

Long jobs default to `concurrent: 1`: if the previous run hasn’t finished, a new due trigger goes into a waiting pool and is dropped after timeout (default about `10_000` ms, tunable with `waitingTimeout`) to avoid stacking. Raise `concurrent`, or set `'infinity'`, when different time slots may overlap.

When a scheduled run also needs CLI args, use `args`—they go through the same [options()](/en/console/options) validation as a hand-typed command; field names must match:

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

## Shared store for multiple replicas

The default `store` is **in-process memory**: fine for a single Console. With multiple Pods / machines, every process fires at the scheduled time—double daily emails and double reconciliations come from here.

To run many replicas but let the same schedule compete for slots cluster-wide under `concurrent`, give `crons()` a **shared store** (usually Redis). Scheduling and mutual exclusion are coordinated by the store; business actions don’t need their own distributed locks.

```typescript
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

crons({
  commanders: './src/commanders',
  port: 9786,
  store: new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 }), // [!code highlight]
});
```

::: warning
If multiple replicas still use the default in-memory store, the same cron fires **once per** replica. Local single-process setups don’t need Redis.
:::

| Approach | When to use |
| --- | --- |
| In-process `@aomex/cron` | Share with `options()`, need mutex and control port |
| System crontab calling `aomex xxx` | Minimal scheduling; OK without in-process locking |

## Next steps

- Commands and aliases: [Command routing](/en/console/commander)
- CLI arguments: [Input options](/en/console/options)
- Console entry: [Console app](/en/console/)
