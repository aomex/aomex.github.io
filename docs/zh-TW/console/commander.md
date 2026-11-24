---
outline: deep
---

# 指令路由

給 Console 定義「動詞短語」指令（如 cache:warm），而不是 HTTP 的 method + path。多個指令可共用一個 Commander 和字首；與 Web 的 Router + `routers()` 結構對稱。

```typescript
import { Commander, commanders, ConsoleApp, options } from '@aomex/console';
import { rule } from '@aomex/common';

export const commander = new Commander({
  prefix: 'cache:', // [!code highlight]
});

commander.create('warm', {
  docs: { summary: '预热缓存' },
  mount: [
    options({
      key: rule.string().optional(),
    }),
  ],
  action: async (ctx) => {
    await ctx.logger.info(`warming ${ctx.options.key ?? 'all'}`);
  },
});

commander.create(['flush', 'clear'], {
  action: async (ctx) => {
    await ctx.logger.info('cache cleared');
  },
});

// ConsoleApp.mount
commanders('./src/commanders');
// 或 commanders([commander])
```

```bash
aomex cache:warm --key users
aomex cache:clear
```

掛了 `options({ ... })` 後，ctx.options 形狀與欄位表一致（與 Web 的 query/body 同一套 rule）。create 裡 action 的返回值會參與程序退出語義；非同步錯誤按框架規則冒泡為失敗退出碼。

create 簽名要點：

```typescript
commander.create(commandName | string[], {
  disabled?: boolean;
  mount?: ConsoleMiddleware[];
  docs?: { summary?: string; description?: string };
  action: (ctx) => any;
});
```

指令名會與構造時的 prefix 拼接；`disabled: true` 時不註冊（按環境關特性方便回滾）。

## prefix

`prefix` 是指令名字首：構造 `new Commander({ prefix: 'cache:' })` 後，`create('warm')` 對外就是 `aomex cache:warm`。按領域劃分（`cache:`、`user:`）可少跨檔案重名，也方便在 `--help` 裡一眼掃到一組相關命令。

未匹配任何指令時，應用通常以**非零退出碼**結束並列印幫助——CI 裡要用退出碼斷言，別隻看 stdout。忘了在 `ConsoleApp.mount` 掛 `commanders(...)` 時，檔案寫了指令 CLI 裡也找不到。

## commanders 註冊

| 組織習慣 | 說明 |
| --- | --- |
| `commanders('./dir')` | 目錄即登錄檔，少維護 import |
| `commanders([a, b])` | 測試或只掛子集 |
| 一域一檔案 | `cache.commander.ts`、`user.commander.ts` |
| 與 Cron 共用 | 定時與手跑同文件、同 `action`；Cron 的 `args` 也要走同一套 `options()`，見 [Cron](/zh-TW/plugins/cron) |
| OpenAPI 落盤 | `openapi()` 與 `commanders()` 一起掛在 Console `mount`，見 [生成OpenAPI](/zh-TW/openapi/) |

## docs 與 disabled

docs 進 --help 摘要；與 options 的 docs 互補。舊指令碼名與新文件名並存時用 commandName 陣列（flush / clear）。

特性開關：

```typescript
commander.create('sync', {
  disabled: process.env['FEATURE_SYNC'] !== '1', // [!code highlight]
  action: async (ctx) => {
    await runSync();
  },
});
```

## 下一步

- 引數校驗：[輸入引數](/zh-TW/console/options)
- 定時：[Cron](/zh-TW/plugins/cron)
- 入口與退出碼：[Console 應用](/zh-TW/console/)