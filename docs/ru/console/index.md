---
outline: deep
---

# Точка входа Console

Сделайте точку входа для команд в терминале: **общие** services и валидаторы с Web, но сценарий — `aomex <команда>`. Подходит для миграций, прогрева кэша, выгрузки OpenAPI, Cron — процесс завершается и не занимает HTTP-порт.


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

ctx.logger имеет завершение (как и в Интернете, оно происходит от подключенного вами сервиса/промежуточного программного обеспечения). После добавления options({ ... }) ctx.options будет собран в объявленной вами форме. app.run() возвращает **код выхода** (0 успешно), фреймворк не будет обрабатывать .exit за вас — это легко проверить в тестах.

::: warning
В случае неудачи не возвращайтесь молча, но все равно получите код выхода 0, CI будет считать это успешным; выдать ошибку или позволить запуску получить ненулевой код.
:::

## запуск указывает подкоманду

` app.run()`Отвечает за синтаксический анализ и выполнение инструкции и возврат кода выхода. Если никакие параметры не передаются,` process.argv `Читаем (и в терминале` npx aomex cache:warm `Одинаковый); вы также можете напрямую передать имя команды и параметры в скрипт теста или оркестрации, не меняя argv:

```typescript
await app.run();
await app.run('cache:warm');
await app.run('export', '--out', 'a.csv');
```

## язык

CLI **не** Accept-Language, язык может быть только строкой (например,` zh-CN `,` en-US `), эффект тот же, что и в Web: проверка options() не удалась, и все подсказки платформы используют этот метод. Не передавайте это в Интернет`{ mode, header }` объект.

```typescript
new ConsoleApp({
  services,
  logger: services.logger,
  language: 'zh-CN', // [!code highlight]
  mount: [commanders('./src/commanders')],
});
```

Пишите дефис в коде языка, не пишите его ` zh_CN `. Для согласования по заголовку запроса см. [Запись веб-приложения · язык](/ru/web/#language). Собственные записи бизнеса по-прежнему отображаются как [Дополнительно: приложение i18n](/ru/advanced/i18n).

## Сравнить с Web

| | Интернет | Консоль |
| --- | --- | --- |
| соответствовать | метод + путь | имя команды |
| входить | запрос/тело/параметры | ` options()` |
| язык | Возможен торг по запросу | можно только исправить |
| жизненный цикл | прослушивание + отключение сигнала | ` run` Просто назовите это день |

Бизнес-сервисы и middleware миксинов можно навешивать с обеих сторон. Обычно действия «Эксплуатация и обслуживание» размещаются в Консоли. Проверьте базу данных и перенесите сторонние сервисы/так же, как и Веб. Не позволяйте HTTP и CLI поддерживать по одному набору каждый.

## Дальше

- [Маршрутизация команд](/ru/console/commander)
- [Параметры ввода](/ru/console/options)
- [Генерация OpenAPI](/ru/openapi/)
- [Крон](/ru/plugins/cron)