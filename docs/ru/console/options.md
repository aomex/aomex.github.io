---
outline: deep
---

# Входные параметры

Используйте --page 1 -d 2024-01-01 в терминале, чтобы собрать **ctx.options**. Правила такие же, как и в Интернете. Проверка не удалась **ненулевой выход**; документы введут --help. argv — это плоский строковый канал, и сложные структуры сначала разбиваются на плоские поля.

```typescript
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
      await ctx.logger.info('export start', { out, date, limit });
    }
    await exportCsv({ out, date, limit });
  },
});
```

```bash
aomex export --out ./a.csv -d 2024-01-01 --limit 50 -v
aomex export --help
```

Подпись запоминает два параметра: **таблица полей** + необязательная **таблица псевдонимов**:

```typescript
options(
  fields: { [key: string]: Validator },
  aliasList?: { [key in keyof fields]?: string | string[] },
)
```

ctx.options соответствует таблице полей один к одному: предел — это число (а не строка), подробный — логическое значение, а дата — это дата после прохождения проверки. Псевдоним расширяется перед проверкой, а длинные и короткие параметры записываются в одном поле.

Не связывайтесь с процессом.argv в действиях — вы потеряете согласованность типов и ненулевые выходы.

## миграция и пробный запуск

Миграция базы данных и пакетные сценарии часто требуют таких переключателей, как «направление, количество шагов, только практика, но не запись». использовать ` rule.boolean()`/` rule.enum()`В опциях заявлен один и тот же набор, который передается в ручной запуск и CI. `--dry-run`, если проверка не удалась, выйдите напрямую с ненулевым значением, что более надежно, чем анализ строки в действии.

```typescript
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
      await ctx.logger.info('dry-run', { direction, steps });
      return;
    }
    await runMigrate({ direction, steps });
  },
});
```

## Совместно с Cron

Когда Cron запустится, поместите параметры в ` args`, снова пройдет ту же проверку options(), что и CLI. Имя и тип поля необходимо вводить вручную. ` aomex export --out ...`Последовательно, иначе он может регулярно обращаться к двери действия, но зависает на уровне проверки.

Аргументы времени должны соответствовать одному и тому же набору правил - в противном случае «параметры онлайн-времени недопустимы»:

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
Имена полей в аргументах Cron должны соответствовать параметрам, в противном случае будет активировано время, и оно завершится ошибкой, как только оно будет проверено. Отдайте приоритет разделению сложных структур на плоские поля. Не вставляйте строку, а затем вручную разбирайте JSON.parse — ни помощь, ни проверка не являются дружественными.
:::

Сторона производства/CI: аргументы, внедренные Cron, используют тот же набор имен параметров, что и сценарий, запускаемый вручную. Локальный многоразовый --help выравнивает поля; в случае неудачи см. код выхода и проверочную копию.

## Дальше

- Командная организация: [Маршрутизация команд](/ru/console/commander)
- Цепочка правил: [Общие цепи](/ru/validators/chain), [Обзор валидаторов](/ru/validators/)
- Параметры времени: [Cron](/ru/plugins/cron)