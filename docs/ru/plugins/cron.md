---
outline: deep
---

# Cron и отложенные задачи

Запуск Console-команд по расписанию в процессе Console — ручной `aomex report:daily` и cron делят **тот же** `action` и `options()`. `crons()` стартует планировщик и HTTP управления; `cron()` в `mount` команды задаёт расписание. Несколько реплик — общий `store`, иначе задачи дублируются.

```bash
pnpm add @aomex/cron
```

## crons() на ConsoleApp

`crons()` в процессе Console: сканирует команды под `commanders` с `cron()`, запускает тот же путь, что CLI, по расписанию. Плюс локальный HTTP для управления (порт настраивается). **Только Console** — не `WebApp.mount`.

::: warning
На `WebApp.mount` смешиваете HTTP и cron — держите раздельно.
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

Расписание на команде (тот же файл, что [Маршрутизация команд](/ru/console/commander)):

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

Запуск: процесс часто долгоживущий; ту же команду можно дергать через CLI `aomex` для отладки.

## ctx.cron в длинных job

Scheduled action делит контекст Console с ручным CLI. В длинных job **ctx.cron** даёт тайминги и два разных «жив ли процесс» — **раздельно**, не в одном условии цикла.

- `scheduleTime` / `executionTime` / `nextScheduleTime`: лог и аудит
- `isAlive()`: ответ на stop от ops
- `isCurrentEpoch()`: ещё текущее окно расписания

`crons()` регистрирует подкоманды управления (например `cron:stats`, `cron:stop` — см. `--help` пакета).

### isAlive(): полу-постоянные циклы

Очереди, polling — «крутиться, пока не остановят» — `while (ctx.cron.isAlive())`. После `cron:stop` → `false`, цикл должен выйти.

```typescript
action: async (ctx) => {
  while (ctx.cron.isAlive()) { // [!code highlight]
    await drainQueue();
  }
};
```

### isCurrentEpoch(): закончить в этом окне

Пакетная работа до следующего триггера — на каждом шаге `isCurrentEpoch()`: `true` — следующее расписание ещё не сработало; `false` — стоп, остаток на следующий запуск.

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

## Поля crons() на уровне приложения

| Поле | Когда использовать | По умолчанию |
| --- | --- | --- |
| `commanders` | Тот же каталог, что `commanders()`, чтобы найти `cron()` | — |
| `port` | Локальный HTTP управления / статус | дефолт пакета |
| `store` | **Несколько машин — обязательно** Redis и т.п. | in-memory (один процесс) |

## Поля cron() на команде

| Поле | Когда использовать | По умолчанию |
| --- | --- | --- |
| `time` / `second`…`minute` | cron из пяти/шести полей или по полям | — |
| `args` | Подставить argv по расписанию | — |
| `concurrent` | Без перекрытия; долгие job часто `1` | `1` |
| `waitingTimeout` | Ждать слот при заполненном concurrent | `10_000` |

Объектная форма эквивалентна строке:

```typescript
cron({
  time: '0 9 * * *', // [!code highlight]
  concurrent: 1,
  args: ['--verbose'],
});
```

### Распределённые job

Дефолтный `store` **в памяти процесса** — одна Console. Несколько Pod — каждый стреляет по расписанию; дублирование суточных отчётов часто отсюда.

Несколько реплик, но кластерный `concurrent` — **общий store** (часто Redis). Планирование и mutex через store — в `action` свой distributed lock не обязателен.

```typescript
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

crons({
  commanders: './src/commanders',
  port: 9786,
  store: new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 }), // [!code highlight]
});
```

::: warning
Memory `store` на нескольких репликах — **один и тот же** cron на **каждой**. Локально на одном процессе Redis не нужен.
:::

| Подход | Когда |
| --- | --- |
| In-process `@aomex/cron` | Общий с `options()`, mutex и control port |
| Системный crontab + `aomex xxx` | Минимум планирования, без in-process lock |

`args` в `cron()` подставляют argv — имена как в [Опции ввода](/ru/console/options).

## Дальше

- Команды и алиасы: [Маршрутизация команд](/ru/console/commander)
- Параметры CLI: [Опции ввода](/ru/console/options)
- Точка входа Console: [Console-приложение](/ru/console/)
