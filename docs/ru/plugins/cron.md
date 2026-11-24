---
outline: deep
---

# Планировщик Cron

В процессе Console по расписанию запускаются уже существующие команды: ручной `aomex report:daily` и таймер идут через **один и тот же** action и `options()`. `crons()` поднимает планировщик и порт управления; `cron()` на mount конкретной команды объявляет расписание. Нескольким репликам нужен общий store, иначе будут повторные срабатывания.

```bash
pnpm add @aomex/cron
```

## ConsoleApp: повесить crons()

`crons()` в процессе Console поднимает планировщик: сканирует каталог `commanders` на команды с `cron()` и в срок выполняет action тем же путём, что CLI. Ещё даёт локальный HTTP-порт управления (`port` обязателен). **Только Console**, не вешайте на WebApp.

::: warning
Монтирование в `WebApp.mount` смешает HTTP и вход планировщика — держите раздельно.
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

`commanders` должен быть **тем же каталогом**, что и `commanders()` ниже, иначе планировщик не увидит `cron()`. `port` — для статуса и остановки на этой машине (диапазон 1–65535).

Расписание объявляют на команде (можно в том же файле, что [маршрутизация команд](/ru/console/commander)):

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

Строка эквивалентна `{ time: '...' }` (пять полей начиная с минуты или шесть с секундами). Можно собирать полями: `minute` / `hour` / `dayOfMonth` и т.д.

Запуск: процесс обычно как постоянный сервис; ту же команду можно вручную гонять через aomex CLI для отладки. `crons()` ещё регистрирует управляющие подкоманды (например `cron:stats`, `cron:stop` — смотрите `--help` пакета).

## Длинные задачи: ctx.cron

Action по таймеру и ручной CLI делят Console-контекст. В долгой работе **ctx.cron** даёт время текущего прогона и два разных признака «живости» — используйте **раздельно по сценарию**, не смешивайте в одном условии цикла.

- `scheduleTime` / `executionTime` / `nextScheduleTime`: логи и аудит
- `isAlive()`: реакция на остановку оператором
- `isCurrentEpoch()`: не истекло ли окно текущего прогона

### isAlive(): полувечный цикл должен слушаться

Очереди, опрос внешнего состояния — логика «крутится, пока кто-то не остановит»: `while (ctx.cron.isAlive())`. После `cron:stop` станет `false`, цикл должен выйти; без проверки дочерний процесс может крутиться вхолостую, пока вы не убьёте его вручную.

```typescript
action: async (ctx) => {
  while (ctx.cron.isAlive()) { // [!code highlight]
    await drainQueue();
  }
};
```

### isCurrentEpoch(): уложиться в окно прогона

Пакет работы, который нужно закончить **до следующего планового срабатывания** (сверка, сканирование таблиц): перед каждым шагом смотрите `isCurrentEpoch()`. `true` — следующее расписание ещё не наступило; `false` — завершайтесь, остаток оставьте следующему прогону, чтобы не наложиться на следующий cron.

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

## Анти-перекрытие и аргументы по таймеру

У длинных задач по умолчанию `concurrent: 1`: пока предыдущий прогон не закончен, новое срабатывание ждёт в пуле и после таймаута (по умолчанию около `10_000` ms, настраивается `waitingTimeout`) отбрасывается. Когда разные моменты времени могут перекрываться — поднимите `concurrent` или поставьте `'infinity'`.

Если таймер ещё должен нести CLI-аргументы — `args`: они снова проходят ту же проверку [options()](/ru/console/options), что и ручной ввод; имена полей должны совпадать:

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

## Несколько реплик: общий store

По умолчанию `store` — **память процесса**: для одного Console хватает. На нескольких Pod / машинах каждый процесс в срок запустит своё — отсюда два дневных отчёта и двойная сверка.

Чтобы реплики работали вместе, а один план во всём кластере брал слот по `concurrent`, дайте `crons()` **общий store** (часто Redis). Планирование и взаимное исключение координирует store; в business action свой распределённый lock не нужен.

```typescript
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

crons({
  commanders: './src/commanders',
  port: 9786,
  store: new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 }), // [!code highlight]
});
```

::: warning
Несколько реплик с дефолтным memory store — один и тот же cron сработает на **каждой** реплике. Локально одному процессу Redis не нужен.
:::

| Способ | Когда |
| --- | --- |
| In-process `@aomex/cron` | общие `options()`, взаимное исключение и порт управления |
| Системный crontab → `aomex xxx` | минимальный таймер, можно без in-process lock |

## Дальше

- Команды и алиасы: [Маршрутизация команд](/ru/console/commander)
- CLI-аргументы: [Входные параметры](/ru/console/options)
- Вход Console: [Console-приложение](/ru/console/)
