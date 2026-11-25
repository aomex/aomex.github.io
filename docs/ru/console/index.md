---
outline: deep
---

# Точка входа Console-приложения

Соберите entry для команд в терминале: те же services, logger и валидаторы, что у Web, но сцена — `aomex <команда>`. Подходит для миграций, прогрева кэша, выгрузки OpenAPI, Cron — отработал и вышел, без занятого HTTP-порта.

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

В бизнес-коде используйте импортированный `logger` (тот же объект, что `ctx.logger`; `ctx.logger` — для стороннего middleware и middleware внутри app). После `options({ ... })` `ctx.options` сойдётся с объявленной формой. `app.run()` возвращает **код выхода** (0 — успех); фреймворк сам `process.exit` не вызывает — удобно в тестах.

::: warning
При ошибке не делайте тихий return с кодом 0 — CI посчитает успехом. Бросайте исключение или добейтесь ненулевого кода от run.
:::

## run с явной подкомандой

`app.run()` разбирает и выполняет одну команду, возвращает код выхода. Без аргументов читает `process.argv` (как `npx aomex cache:warm` в терминале). В тестах и скриптах можно передать имя команды и флаги без подмены argv:

```typescript
await app.run();
await app.run('cache:warm');
await app.run('export', '--out', 'a.csv');
```

## language

У CLI **нет** Accept-Language: `language` — только строка (`zh-CN`, `en-US` и т.д.), как fixed в Web: ошибки `options()` и системные подсказки на этом языке. Не передавайте объект `{ mode, header }` как в Web.

```typescript
import { logger } from '@/services/logger.service';

new ConsoleApp({
  services,
  logger,
  language: 'zh-CN', // [!code highlight]
  mount: [commanders('./src/commanders')],
});
```

Код языка с дефисом, не `zh_CN`. Согласование по заголовку в Web — [точка входа Web · language](/ru/web/#language). Свои фразы продукта — [продвинутое: i18n приложения](/ru/advanced/i18n).

## Сравнение с Web

| | Web | Console |
| --- | --- | --- |
| Совпадение | method + path | имя команды |
| Ввод | query / body / params | `options()` |
| Язык | можно по запросу | только фиксированный |
| Жизненный цикл | listen + сигналы | завершение после `run` |

Бизнес-сервисы и mixin-middleware работают в обоих сценах. Операционные задачи чаще в Console. Доступ к БД и внешним API — в services/, как в Web, без двух параллельных наборов.

## Дальше

- [маршрутизация команд](/ru/console/commander)
- [входные параметры](/ru/console/options)
- [генерация OpenAPI](/ru/openapi/)
- [Cron](/ru/plugins/cron)