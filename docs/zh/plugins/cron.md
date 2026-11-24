---
outline: deep
---

# 定时任务 Cron

在 Console 进程里按时间表跑已有指令：手敲 aomex report:daily 与定时触发走**同一条** action 和 options()。crons() 起调度与管控口；cron() 挂在具体指令的 mount 上声明计划。多副本要共享 store，否则会重复触发。

```bash
pnpm add @aomex/cron
```

## ConsoleApp 挂 crons()

`crons()` 在 Console 进程里起调度器：扫 `commanders` 目录里带了 `cron()` 的指令，到点用与 CLI 相同的路径执行 action。还提供本机 HTTP 管控口（`port` 必填）。**只挂 Console**，不要挂 WebApp。

::: warning
挂到 `WebApp.mount` 会把 HTTP 与计划任务入口混在一起，应分开。
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

`commanders` 要和下面的 `commanders()` **同目录**，调度才能扫到 `cron()`。`port` 给本机查状态、停任务用（有效范围 1–65535）。

在指令上声明计划（与 [指令路由](/zh/console/commander) 同文件即可）：

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

字符串写法等价 `{ time: '...' }`（五段从分起，或六段含秒）。也可用字段组合：`minute` / `hour` / `dayOfMonth` 等。

运行：进程常作为常驻服务；也可只靠 aomex CLI 手跑同一条指令做排障。`crons()` 还会注册管控类子命令（如 `cron:stats`、`cron:stop` 等，以包内 `--help` 为准）。

## 长任务里用 ctx.cron

定时触发的 action 和手跑 CLI 共用 Console 上下文。跑得久的任务里，**ctx.cron** 给出本轮调度时间，以及两种不同用途的存活判断——按场景**分开用**，不要揉进同一个循环条件里硬套。

- `scheduleTime` / `executionTime` / `nextScheduleTime`：打日志、审计用
- `isAlive()`：响应运维叫停
- `isCurrentEpoch()`：本轮时间窗是否还没过期

### isAlive()：半永久循环要听停

消费队列、轮询外部状态这类「一直转到有人喊停」的逻辑，用 `while (ctx.cron.isAlive())`。运维执行 `cron:stop` 后会变 `false`，循环应退出；不查的话子进程可能空转到你手动杀。

```typescript
action: async (ctx) => {
  while (ctx.cron.isAlive()) { // [!code highlight]
    await drainQueue();
  }
};
```

### isCurrentEpoch()：本轮窗内做完就收

一批要在「下一次计划触发之前」收尾的工作（对账、扫表），处理每一步前查 `isCurrentEpoch()`：仍为 `true` 说明下一次调度还没到；变 `false` 就收工，把剩余留给下一轮，避免和下一趟 cron 叠车。

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

## 防重叠与定时带参

长任务默认 `concurrent: 1`：上一轮还没跑完，新到点的触发会进等待池，超时（默认约 `10_000` ms，可用 `waitingTimeout` 调）后丢掉，避免叠车。需要不同时间点允许重叠时再把 `concurrent` 调大，或设 `'infinity'`。

定时跑还要带 CLI 参数时，用 `args`——会再走一遍与手敲相同的 [options()](/zh/console/options) 校验，字段名必须对齐：

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

## 多副本换共享 store

默认 `store` 是**进程内内存**：单机 Console 够用。上了多 Pod / 多机后，每个进程各自到点都会跑一遍——日报发两封、对账跑两遍就从这儿来。

要多副本一起跑、但同一计划在全集群只按 `concurrent` 抢槽，就给 `crons()` 换**共享 store**（常用 Redis）。调度与互斥靠 store 协调，业务 action 不用自己加分布式锁。

```typescript
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

crons({
  commanders: './src/commanders',
  port: 9786,
  store: new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 }), // [!code highlight]
});
```

::: warning
多副本仍用默认内存 store 时，同一 cron 会在**每个**副本各触发一次。本地单进程不必上 Redis。
:::

| 方式 | 什么时候用 |
| --- | --- |
| 进程内 `@aomex/cron` | 与 `options()` 共用、要互斥与管控口 |
| 系统 crontab 调 `aomex xxx` | 极简定时、可接受无进程内抢锁 |

## 下一步

- 指令与别名：[指令路由](/zh/console/commander)
- CLI 参数：[输入参数](/zh/console/options)
- Console 入口：[Console 应用](/zh/console/)
