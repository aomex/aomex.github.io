---
outline: deep
---

# Маршрутизация команд

Определите инструкции «глагольной фразы» (например, кэш:теплый) для консоли вместо метода HTTP + путь. Несколько команд могут использовать один и тот же Commander и префикс; то же, что и веб-маршрутизатор +`routers()` Структурная симметрия.

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
    await ctx.logger.info(` warming ${ctx.options.key ?? 'all'}`);
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

Вешать трубку ` options({ ... })`Наконец, форма ctx.options соответствует таблице полей (тот же набор правил, что и запрос/тело Интернета). Возвращаемое значение действия в create будет участвовать в семантике выхода процесса; асинхронные ошибки всплывают до кодов выхода из сбоя в соответствии с правилами платформы.

Ключевые моменты создания подписи:

```typescript
commander.create(commandName | string[], {
  disabled?: boolean;
  mount?: ConsoleMiddleware[];
  docs?: { summary?: string; description?: string };
  action: (ctx) => any;
});
```

Имя инструкции будет объединено с префиксом во время построения;` disabled: true ` Регистрация не требуется (отключите эту функцию в зависимости от среды, чтобы облегчить откат).

## префикс

` prefix ` это префикс имени команды: конструкция ` new Commander({ prefix: 'cache:' })` назад,` create('warm')` Внешне это ` aomex cache:warm `. По полю (` cache:`,` user:`) может уменьшить количество повторяющихся имен в файлах, а также удобен для `--help ` Я взглянул на группу связанных команд.

Если никакие инструкции не совпадают, приложение обычно завершается с ненулевым кодом выхода и выводит справку — используйте утверждения кода выхода в CI, а не просто смотрите на стандартный вывод. Забыл быть ` ConsoleApp.mount ` вешать ` commanders(...)` Когда файл записан с инструкциями, его невозможно найти в CLI.

## регистрация командиров

| организационные привычки | иллюстрировать |
| --- | --- |
| ` commanders('./dir')` | Каталог — это реестр, меньше импорта обслуживания. |
| ` commanders([a, b])` | Тестируйте или вешайте только подмножество |
| Один домен, один файл | ` cache.commander.ts `,` user.commander.ts ` |
| Совместно с Cron | Синхронизация и запуск одного и того же файла вручную и ` action `;Крона ` args ` Нам придется идти по тому же пути ` options()`, см. [Cron](/ru/plugins/cron) |
| Размещение OpenAPI | ` openapi()` и ` commanders()` Держитесь вместе в консоли ` mount `, см. [Генерация OpenAPI](/ru/openapi/) |

## документы и отключены

документы в --help summary; дополняет документацию по опциям. Используйте массив CommandName (сбросить/очистить), если старое имя сценария и новое имя документа сосуществуют.

Переключатель функций:

```typescript
commander.create('sync', {
  disabled: process.env['FEATURE_SYNC'] !== '1', // [!code highlight]
  action: async (ctx) => {
    await runSync();
  },
});
```

## Дальше

- Проверка параметров: [Параметры ввода](/ru/console/options)
- Время: [Cron](/ru/plugins/cron)
- Код входа и выхода: [Консольное приложение](/ru/console/)