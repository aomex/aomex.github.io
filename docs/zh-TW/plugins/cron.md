---
outline: deep
---

# 定時任務 Cron

在 Console 程序裡按時間表跑已有指令：手敲 aomex report:daily 與定時觸發走**同一條** action 和 options()。crons() 起排程與管控口；cron() 掛在具體指令的 mount 上宣告計劃。多副本要共享 store，否則會重複觸發。

```bash
pnpm add @aomex/cron
```

## ConsoleApp 掛 crons()

`crons()` 在 Console 程序裡起排程器：掃 `commanders` 目錄裡帶了 `cron()` 的指令，到點用與 CLI 相同的路徑執行 action。還提供本機 HTTP 管控口（`port` 必填）。**只掛 Console**，不要掛 WebApp。

::: warning
掛到 `WebApp.mount` 會把 HTTP 與計劃任務入口混在一起，應分開。
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

`commanders` 要和下面的 `commanders()` **同目錄**，排程才能掃到 `cron()`。`port` 給本機查狀態、停任務用（有效範圍 1–65535）。

在指令上宣告計劃（與 [指令路由](/zh-TW/console/commander) 同文件即可）：

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

字串寫法等價 `{ time: '...' }`（五段從分起，或六段含秒）。也可用欄位組合：`minute` / `hour` / `dayOfMonth` 等。

執行：程序常作為常駐服務；也可只靠 aomex CLI 手跑同一條指令做排障。`crons()` 還會註冊管控類子命令（如 `cron:stats`、`cron:stop` 等，以包內 `--help` 為準）。

## 長任務裡用 ctx.cron

定時觸發的 action 和手跑 CLI 共用 Console 上下文。跑得久的任務裡，**ctx.cron** 給出本輪排程時間，以及兩種不同用途的存活判斷——按場景**分開用**，不要揉進同一個迴圈條件裡硬套。

- `scheduleTime` / `executionTime` / `nextScheduleTime`：打日誌、審計用
- `isAlive()`：響應運維叫停
- `isCurrentEpoch()`：本輪時間窗是否還沒過期

### isAlive()：半永久迴圈要聽停

消費佇列、輪詢外部狀態這類「一直轉到有人喊停」的邏輯，用 `while (ctx.cron.isAlive())`。運維執行 `cron:stop` 後會變 `false`，迴圈應退出；不查的話子程序可能空轉到你手動殺。

```typescript
action: async (ctx) => {
  while (ctx.cron.isAlive()) { // [!code highlight]
    await drainQueue();
  }
};
```

### isCurrentEpoch()：本輪窗內做完就收

一批要在「下一次計劃觸發之前」收尾的工作（對賬、掃表），處理每一步前查 `isCurrentEpoch()`：仍為 `true` 說明下一次排程還沒到；變 `false` 就收工，把剩餘留給下一輪，避免和下一趟 cron 疊車。

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

## 防重疊與定時帶參

長任務預設 `concurrent: 1`：上一輪還沒跑完，新到點的觸發會進等待池，超時（預設約 `10_000` ms，可用 `waitingTimeout` 調）後丟掉，避免疊車。需要不同時間點允許重疊時再把 `concurrent` 調大，或設 `'infinity'`。

定時跑還要帶 CLI 引數時，用 `args`——會再走一遍與手敲相同的 [options()](/zh-TW/console/options) 校驗，欄位名必須對齊：

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

## 多副本換共享 store

預設 `store` 是**程序內記憶體**：單機 Console 夠用。上了多 Pod / 多機後，每個程序各自到點都會跑一遍——日報發兩封、對賬跑兩遍就從這兒來。

要多副本一起跑、但同一計劃在全叢集只按 `concurrent` 搶槽，就給 `crons()` 換**共享 store**（常用 Redis）。排程與互斥靠 store 協調，業務 action 不用自己加分散式鎖。

```typescript
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

crons({
  commanders: './src/commanders',
  port: 9786,
  store: new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 }), // [!code highlight]
});
```

::: warning
多副本仍用預設記憶體 store 時，同一 cron 會在**每個**副本各觸發一次。本地單程序不必上 Redis。
:::

| 方式 | 什麼時候用 |
| --- | --- |
| 程序內 `@aomex/cron` | 與 `options()` 共用、要互斥與管控口 |
| 系統 crontab 調 `aomex xxx` | 極簡定時、可接受無程序內搶鎖 |

## 下一步

- 指令與別名：[指令路由](/zh-TW/console/commander)
- CLI 引數：[輸入引數](/zh-TW/console/options)
- Console 入口：[Console 應用](/zh-TW/console/)
