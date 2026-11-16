---
outline: deep
---

# Cron scheduled tasks

Run existing Console commands on a schedule in the Console process—manual `aomex report:daily` and cron triggers share the **same** `action` and `options()`. `crons()` starts the scheduler and control HTTP port; `cron()` on a command `mount` declares the schedule. Multiple replicas need a shared `store` or jobs fire twice.

```bash
pnpm add @aomex/cron
```

## Mount crons() on ConsoleApp

`crons()` starts the scheduler in the Console process: scans commands under `commanders` that mount `cron()`, runs the same path as CLI at schedule. Also exposes local HTTP control (default port configurable). **Console only**—not `WebApp.mount`.

::: warning
Mounting on `WebApp.mount` mixes HTTP with scheduled jobs—keep them separate.
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

Declare schedule on the command (same file as [Command routing](/en/console/commander)):

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

Run: process often stays resident; you can still run the same command via `aomex` CLI for debugging.

## ctx.cron in long jobs

Scheduled actions share Console context with manual CLI. In long jobs **ctx.cron** exposes schedule timing and two different “still alive” checks—**use separately**, do not mash into one loop condition.

- `scheduleTime` / `executionTime` / `nextScheduleTime`: logging and audit
- `isAlive()`: respond to ops stop
- `isCurrentEpoch()`: whether this schedule window is still current

`crons()` also registers control subcommands (e.g. `cron:stats`, `cron:stop`—see package `--help`).

### isAlive(): semi-permanent loops

Queue consumers, polling loops—“run until someone stops”—use `while (ctx.cron.isAlive())`. After `cron:stop` it becomes `false` and the loop should exit.

```typescript
action: async (ctx) => {
  while (ctx.cron.isAlive()) { // [!code highlight]
    await drainQueue();
  }
};
```

### isCurrentEpoch(): finish inside this window

Batch work that must complete before the next trigger—check `isCurrentEpoch()` each step: `true` means next schedule has not fired; `false` stop and leave remainder for the next run.

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

## crons() app-level fields

| Field | When to use | Default |
| --- | --- | --- |
| `commanders` | Same directory as `commanders()` so scheduler finds `cron()` | — |
| `port` | Local HTTP control / status | package default |
| `store` | **Multi-machine must** Redis etc. | in-memory (single process) |

## cron() per-command fields

| Field | When to use | Default |
| --- | --- | --- |
| `time` / `second`…`minute` | Five/six-field cron or field combo | — |
| `args` | Inject CLI args on schedule | — |
| `concurrent` | Prevent overlap; long jobs often `1` | `1` |
| `waitingTimeout` | Wait for slot when concurrent full | `10_000` |

Object form equivalent to string:

```typescript
cron({
  time: '0 9 * * *', // [!code highlight]
  concurrent: 1,
  args: ['--verbose'],
});
```

### Distributed jobs

Default `store` is **in-process memory**—fine for single Console. Multiple Pods each fire on schedule—duplicate daily reports often start here.

For multiple replicas but cluster-wide `concurrent` slots, pass a **shared store** (often Redis). Scheduling and mutex use the store—business `action` need not add its own distributed lock.

```typescript
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

crons({
  commanders: './src/commanders',
  port: 9786,
  store: new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 }), // [!code highlight]
});
```

::: warning
Default memory `store` on multiple replicas runs the **same** cron on **each** replica. Single process locally does not need Redis.
:::

| Approach | When to use |
| --- | --- |
| In-process `@aomex/cron` | Shared with `options()`, mutex and control port |
| System crontab calling `aomex xxx` | Minimal scheduling, no in-process locking |

`cron()` `args` inject argv—they must match [Input options](/en/console/options) field names.

## Next steps

- Commands and aliases: [Command routing](/en/console/commander)
- CLI params: [Input options](/en/console/options)
- Console entry: [Console app](/en/console/)