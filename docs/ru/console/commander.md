---
outline: deep
---

# Маршрутизация команд

В Console задаёте команды в виде «глагольных фраз» (например `cache:warm`), а не method + path как в HTTP. Несколько команд могут делить один Commander и prefix; зеркально Router + `routers()` в Web.

```typescript
import { logger } from '@/services/logger.service';

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
    logger.info(`warming ${ctx.options.key ?? 'all'}`);
  },
});

commander.create(['flush', 'clear'], {
  action: async (ctx) => {
    logger.info('cache cleared');
  },
});

// ConsoleApp.mount
commanders('./src/commanders');
// или commanders([commander])
```

```bash
aomex cache:warm --key users
aomex cache:clear
```

С `options({ ... })` форма `ctx.options` совпадает с таблицей полей (те же rule, что query/body в Web). Возврат action в `create` влияет на семантику кода выхода процесса; асинхронные ошибки всплывают в код неуспеха по правилам фреймворка.

Суть сигнатуры `create`:

```typescript
commander.create(commandName | string[], {
  disabled?: boolean;
  mount?: ConsoleMiddleware[];
  docs?: { summary?: string; description?: string };
  action: (ctx) => any;
});
```

Имя команды склеивается с `prefix` конструктора. При `disabled: true` регистрации нет — удобно рубить фичу по окружению.

## prefix

`prefix` — префикс имени команды. После `new Commander({ prefix: 'cache:' })` вызов `create('warm')` снаружи — `aomex cache:warm`. Разбивка по доменам (`cache:`, `user:`) снижает коллизии между файлами и группирует команды в `--help`.

Если ничего не совпало, приложение обычно завершается с **ненулевым кодом** и печатает help — в CI проверяйте код выхода, а не только stdout. Без `commanders(...)` в `ConsoleApp.mount` команды из файлов в CLI не появятся.

## Регистрация commanders

| Стиль | Заметки |
| --- | --- |
| `commanders('./dir')` | каталог как реестр, меньше ручных import |
| `commanders([a, b])` | тесты или подмножество |
| один файл на домен | `cache.commander.ts`, `user.commander.ts` |
| вместе с Cron | cron и ручной запуск — один файл, один `action`; `args` у Cron через те же `options()`, см. [Cron](/ru/plugins/cron) |
| вывод OpenAPI | `openapi()` и `commanders()` вместе в `mount` Console, см. [генерация OpenAPI](/ru/openapi/) |

## docs и disabled

`docs` попадают в краткое `--help`; дополняют `docs` у options. Два имени скрипта — массив commandName (flush / clear).

Флаг фичи:

```typescript
commander.create('sync', {
  disabled: process.env['FEATURE_SYNC'] !== '1', // [!code highlight]
  action: async (ctx) => {
    await runSync();
  },
});
```

## Дальше

- Проверка аргументов: [входные параметры](/ru/console/options)
- По расписанию: [Cron](/ru/plugins/cron)
- Точка входа и коды выхода: [Console-приложение](/ru/console/)