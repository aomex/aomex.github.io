---
outline: deep
---

# 指令路由

给 Console 定义「动词短语」指令（如 cache:warm），而不是 HTTP 的 method + path。多个指令可共用一个 Commander 和前缀；与 Web 的 Router + `routers()` 结构对称。

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

挂了 `options({ ... })` 后，ctx.options 形状与字段表一致（与 Web 的 query/body 同一套 rule）。create 里 action 的返回值会参与进程退出语义；异步错误按框架规则冒泡为失败退出码。

create 签名要点：

```typescript
commander.create(commandName | string[], {
  disabled?: boolean;
  mount?: ConsoleMiddleware[];
  docs?: { summary?: string; description?: string };
  action: (ctx) => any;
});
```

指令名会与构造时的 prefix 拼接；`disabled: true` 时不注册（按环境关特性方便回滚）。

## prefix

`prefix` 是指令名前缀：构造 `new Commander({ prefix: 'cache:' })` 后，`create('warm')` 对外就是 `aomex cache:warm`。按领域划分（`cache:`、`user:`）可少跨文件重名，也方便在 `--help` 里一眼扫到一组相关命令。

未匹配任何指令时，应用通常以**非零退出码**结束并打印帮助——CI 里要用退出码断言，别只看 stdout。忘了在 `ConsoleApp.mount` 挂 `commanders(...)` 时，文件写了指令 CLI 里也找不到。

## commanders 注册

| 组织习惯 | 说明 |
| --- | --- |
| `commanders('./dir')` | 目录即注册表，少维护 import |
| `commanders([a, b])` | 测试或只挂子集 |
| 一域一文件 | `cache.commander.ts`、`user.commander.ts` |
| 与 Cron 共用 | 定时与手跑同文件、同 `action`；Cron 的 `args` 也要走同一套 `options()`，见 [Cron](/zh/plugins/cron) |
| OpenAPI 落盘 | `openapi()` 与 `commanders()` 一起挂在 Console `mount`，见 [生成OpenAPI](/zh/openapi/) |

## docs 与 disabled

docs 进 --help 摘要；与 options 的 docs 互补。旧脚本名与新文档名并存时用 commandName 数组（flush / clear）。

特性开关：

```typescript
commander.create('sync', {
  disabled: process.env['FEATURE_SYNC'] !== '1', // [!code highlight]
  action: async (ctx) => {
    await runSync();
  },
});
```

## 下一步

- 参数校验：[输入参数](/zh/console/options)
- 定时：[Cron](/zh/plugins/cron)
- 入口与退出码：[Console 应用](/zh/console/)