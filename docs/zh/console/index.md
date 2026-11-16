---
outline: deep
---

# Console 应用入口

做一个能在终端跑的指令入口：和 Web **共用** services / 验证器，但舞台是 `aomex <命令>`。适合迁移、预热缓存、落盘 OpenAPI、Cron——跑完就退出，不必占 HTTP 端口。

```bash
pnpm add @aomex/console @aomex/common @aomex/logger
```

```typescript
import { combineServices } from '@aomex/common';
import { Commander, commanders, ConsoleApp } from '@aomex/console';

const services = await combineServices(
  {
    logger: () => import('./services/logger.service.js'),
  },
  { eager: ['logger'] },
);

const commander = new Commander();
commander.create('hello', {
  action: async (ctx) => {
    await ctx.logger.info('hello from console');
  },
});

const app = new ConsoleApp({ // [!code focus:6]
  services,
  logger: services.logger,
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

ctx.logger 有补全（和 Web 一样来自你挂的服务 / 中间件）。以后加上 options({ ... })，ctx.options 会收成你声明的形状。app.run() 返回的是**退出码**（0 成功），框架不会替你 process.exit——测试里好断言。

::: warning
失败时别静默 return 却仍是退出码 0，CI 会当成功；应抛错或让 run 收到非零码。
:::

## run 指定子命令

`app.run()` 负责解析并执行一条指令，返回退出码。不传参数时从 `process.argv` 读（和终端里 `npx aomex cache:warm` 一样）；测试或编排脚本里也可以直接传入指令名和参数，不必改 argv：

```typescript
await app.run();
await app.run('cache:warm');
await app.run('export', '--out', 'a.csv');
```

## language

CLI **没有** Accept-Language，language 只能是字符串（如 `zh-CN`、`en-US`），效果和 Web 的 fixed 一样：options() 校验失败、框架提示都走这一种。别传 Web 那种 `{ mode, header }` 对象。

```typescript
new ConsoleApp({
  services,
  logger: services.logger,
  language: 'zh-CN', // [!code highlight]
  mount: [commanders('./src/commanders')],
});
```

语言码写连字符，别写 `zh_CN`。Web 若要按请求头协商，见 [Web 应用入口 · language](/zh/web/#language)。业务自己的词条仍看 [高级：业务国际化](/zh/advanced/i18n)。

## 和 Web 对照

| | Web | Console |
| --- | --- | --- |
| 匹配 | method + path | 指令名 |
| 输入 | query / body / params | `options()` |
| 语言 | 可按请求协商 | 只能固定 |
| 生命周期 | listen + 信号关停 | `run` 结束就收工 |

业务 service、mixin 中间件两边都能挂。通常把「运维向」的活放 Console。查库、调第三方跟 Web 一样放进 services/，别让 HTTP 和 CLI 各维护一套。

## 下一步

- [指令路由](/zh/console/commander)
- [输入参数](/zh/console/options)
- [OpenAPI 落盘](/zh/console/openapi)
- [定时任务 Cron](/zh/plugins/cron)