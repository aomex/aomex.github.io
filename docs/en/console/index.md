---
outline: deep
---

# Console app entry

Build a terminal command entry that **shares** services and validators with Web, but runs as `aomex <command>`. Good for migrations, cache warm-up, OpenAPI export, Cron—exit when done without holding an HTTP port.

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

`ctx.logger` autocompletes (same as Web—from mounted services / middleware). With `options({ ... })`, `ctx.options` narrows to your declared shape. `app.run()` returns an **exit code** (0 success); the framework does not call `process.exit` for you—easy to assert in tests.

::: warning
On failure, do not silently `return` with exit code 0—CI will treat it as success. Throw or ensure `run` sees a non-zero code.
:::

## Passing a subcommand to `run`

`app.run()` parses and runs one command, returning the exit code. With no args it reads `process.argv` (like `npx aomex cache:warm` in the shell); in tests or scripts you can pass the command name and args directly:

```typescript
await app.run();
await app.run('cache:warm');
await app.run('export', '--out', 'a.csv');
```

## language

CLI has **no** `Accept-Language`; `language` must be a string (e.g. `zh-CN`, `en-US`), same effect as Web `fixed`: `options()` validation errors and framework messages use that locale. Do not pass Web’s `{ mode, header }` object.

```typescript
new ConsoleApp({
  services,
  logger: services.logger,
  language: 'zh-CN', // [!code highlight]
  mount: [commanders('./src/commanders')],
});
```

Use hyphenated locale codes, not `zh_CN`. For Web header negotiation see [Web app entry · language](/en/web/#language). Your own copy still lives in [Advanced: app i18n](/en/advanced/i18n).

## Web vs Console

| | Web | Console |
| --- | --- | --- |
| Match | method + path | command name |
| Input | query / body / params | `options()` |
| Language | can negotiate per request | fixed only |
| Lifecycle | listen + signal shutdown | ends when `run` finishes |

Business services and mixin middleware work on both sides. Put ops-style work on Console. DB and third-party calls belong in `services/` like Web—do not maintain two copies for HTTP and CLI.

## Next steps

- [Command routing](/en/console/commander)
- [Input options](/en/console/options)
- [OpenAPI export](/en/console/openapi)
- [Cron](/en/plugins/cron)