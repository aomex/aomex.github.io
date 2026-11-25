---
outline: deep
---

# Console 應用入口

做一個能在終端跑的指令入口：和 Web **共用** services、logger 與驗證器，但舞臺是 `aomex <命令>`。適合遷移、預熱快取、落盤 OpenAPI、Cron——跑完就退出，不必佔 HTTP 埠。

```bash
pnpm add @aomex/console @aomex/common @aomex/logger
```

```typescript
import { Commander, commanders, ConsoleApp } from '@aomex/console';
import { logger } from '@/services/logger.service';
import { services } from '@/services';

const commander = new Commander();
commander.create('hello', {
  action: async () => {
    logger.info('hello from console');
  },
});

const app = new ConsoleApp({ // [!code focus:6]
  services,
  logger, // [!code highlight]
  language: 'zh-CN',
  mount: [commanders([commander])], // [!code highlight]
});

const code = await app.run();
process.exit(code);

declare module '@aomex/console' {
  namespace ConsoleApp {
    type T = ConsoleApp.Infer<typeof app>;
    interface Props extends T {}
  }
}
```

```bash
npx aomex hello
```

業務裡直接用上面引入的 `logger`（與 `ctx.logger` 同一引用；`ctx.logger` 給第三方中介軟體和 app 內中介軟體）。以後加上 options({ ... })，ctx.options 會收成你宣告的形狀。app.run() 返回的是**退出碼**（0 成功），框架不會替你 process.exit——測試裡好斷言。

::: warning
失敗時別靜默 return 卻仍是退出碼 0，CI 會當成功；應拋錯或讓 run 收到非零碼。
:::

## run 指定子命令

`app.run()` 負責解析並執行一條指令，返回退出碼。不傳引數時從 `process.argv` 讀（和終端裡 `npx aomex cache:warm` 一樣）；測試或編排腳本里也可以直接傳入指令名和引數，不必改 argv：

```typescript
await app.run();
await app.run('cache:warm');
await app.run('export', '--out', 'a.csv');
```

## language

CLI **沒有** Accept-Language，language 只能是字串（如 `zh-CN`、`en-US`），效果和 Web 的 fixed 一樣：options() 校驗失敗、框架提示都走這一種。別傳 Web 那種 `{ mode, header }` 物件。

```typescript
import { logger } from '@/services/logger.service';

new ConsoleApp({
  services,
  logger,
  language: 'zh-CN', // [!code highlight]
  mount: [commanders('./src/commanders')],
});
```

語言碼寫連字元，別寫 `zh_CN`。Web 若要按請求頭協商，見 [Web 應用入口 · language](/zh-TW/web/#language)。業務自己的詞條仍看 [高階：業務國際化](/zh-TW/advanced/i18n)。

## 和 Web 對照

| | Web | Console |
| --- | --- | --- |
| 匹配 | method + path | 指令名 |
| 輸入 | query / body / params | `options()` |
| 語言 | 可按請求協商 | 只能固定 |
| 生命週期 | listen + 訊號關停 | `run` 結束就收工 |

業務 service、mixin 中介軟體兩邊都能掛。通常把「運維向」的活放 Console。查庫、調第三方跟 Web 一樣放進 services/，別讓 HTTP 和 CLI 各維護一套。

## 下一步

- [指令路由](/zh-TW/console/commander)
- [輸入引數](/zh-TW/console/options)
- [生成OpenAPI](/zh-TW/openapi/)
- [定時任務 Cron](/zh-TW/plugins/cron)