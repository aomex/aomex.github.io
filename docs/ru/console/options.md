---
outline: deep
---

# Входные параметры

Соберите `--page 1`, `-d 2024-01-01` из терминала в **ctx.options** по тем же rule, что в Web. Ошибка валидации — **ненулевой выход**; `docs` попадают в `--help`. argv — плоский канал строк, сложные структуры лучше разложить на плоские поля.

```typescript
import { logger } from '@/services/logger.service';

import { rule } from '@aomex/common';
import { Commander, options } from '@aomex/console';

const commander = new Commander();

commander.create('export', {
  mount: [
    options( // [!code highlight]
      {
        out: rule.string().docs({ description: '输出路径' }),
        date: rule.date('yyyy-MM-dd').optional(),
        limit: rule.int().min(1).default(100),
        verbose: rule.boolean().default(false),
      },
      {
        out: ['o'],
        date: ['d'],
        verbose: ['v'],
      },
    ),
  ],
  action: async (ctx) => {
    const { out, date, limit, verbose } = ctx.options;
    if (verbose) {
      logger.info(`export start out=${out} date=${date} limit=${limit}`);
    }
    await exportCsv({ out, date, limit });
  },
});
```

```bash
aomex export --out ./a.csv -d 2024-01-01 --limit 50 -v
aomex export --help
```

Два аргумента: **таблица полей** + необязательная **таблица алиасов**:

```typescript
options(
  fields: { [key: string]: Validator },
  aliasList?: { [key in keyof fields]?: string | string[] },
)
```

`ctx.options` один к одному с полями: `limit` — number, `verbose` — boolean, после проверки `date` — Date. Алиасы раскрываются **до** валидации, короткие и длинные флаги пишут в одно поле.

Не разбирайте `process.argv` вручную в action — потеряете типы и согласованный ненулевой выход.

## migrate и dry-run

Для миграций БД и пакетных задач часто нужны направление, число шагов и «прогон без записи». Объявите `rule.boolean()` / `rule.enum()` в options — и руками, и в CI те же `--dry-run`; при ошибке сразу ненулевой код, надёжнее parse строк в action.

```typescript
import { logger } from '@/services/logger.service';

commander.create('migrate', {
  mount: [
    options({ // [!code highlight]
      direction: rule.enum(['up', 'down'] as const).default('up'),
      steps: rule.int().min(1).optional(),
      dryRun: rule.boolean().default(false),
    }),
  ],
  action: async (ctx) => {
    const { direction, steps, dryRun } = ctx.options;
    if (dryRun) {
      logger.info(`dry-run direction=${direction} steps=${steps ?? ''}`);
      return;
    }
    await runMigrate({ direction, steps });
  },
});
```

## Совместно с Cron

При срабатывании Cron аргументы из `args` снова проходят ту же `options()`, что CLI. Имена и типы полей должны совпадать с ручным `aomex export --out ...`, иначе cron дойдёт до action и упадёт на валидации.

`args` у Cron обязаны есть на том же наборе правил — иначе «в проде cron с невалидными параметрами»:

```typescript
import { cron } from '@aomex/cron';

commander.create('export', {
  mount: [
    cron({ // [!code highlight]
      time: '0 2 * * *',
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

::: warning
Имена полей в `args` Cron должны совпадать с options. Иначе cron сработает и упадёт на валидации. Сложные структуры разбивайте на плоские поля, не пихайте JSON в одну строку с ручным parse — и help, и проверка страдают.
:::

В проде / CI: те же имена опций, что у ручного скрипта. Локально выравнивайтесь через `--help`; при сбое смотрите код выхода и текст валидации.

## Дальше

- Организация команд: [маршрутизация команд](/ru/console/commander)
- Цепочки rule: [общая цепочка](/ru/validators/chain), [быстрый старт валидаторов](/ru/validators/)
- Параметры cron: [Cron](/ru/plugins/cron)