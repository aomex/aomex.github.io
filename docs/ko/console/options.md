---
outline: deep
---

# 입력 옵션

터미널의 `--page 1`, `-d 2024-01-01` 같은 플래그를 **ctx.options**로 모읍니다. rule은 Web과 같습니다. 검증 실패 시 **0이 아닌 종료**; `docs`는 `--help`에 반영됩니다. argv는 평탄한 문자열 채널이므로 복잡한 구조는 평탄한 필드로 나누는 편이 낫습니다.

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

서명은 두 인자를 기억하세요: **필드 표** + 선택 **별칭 표**:

```typescript
options(
  fields: { [key: string]: Validator },
  aliasList?: { [key in keyof fields]?: string | string[] },
)
```

`ctx.options`는 필드 표와 1:1입니다. `limit`은 number(문자열 아님), `verbose`는 boolean, `date`는 검증 후 `Date`입니다. 별칭은 검증 **전**에 펼쳐지고 짧은·긴 옵션이 같은 필드에 씁니다.

`action`에서 `process.argv`를 직접 파싱하지 마세요. 타입과 일관된 0이 아닌 종료를 잃습니다.

## migrate와 dry-run

마이그레이션·배치 작업에는 방향, 단계 수, dry-run 스위치가 자주 필요합니다. `rule.boolean()` / `rule.enum()`으로 options에 선언하면 수동·CI가 같은 `--dry-run`을 쓰고, 검증 실패는 바로 0이 아닌 종료입니다. action에서 문자열을 파싱하는 것보다 낫습니다.

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

## Cron과 공유

Cron이 트리거되면 `args`에 인자를 넣고 CLI와 **같은** `options()` 검증을 다시 탑니다. 필드 이름·타입은 `aomex export --out ...`을 손으로 칠 때와 같아야 하며, 그렇지 않으면 스케줄은 action 앞까지 가다 검증에서 실패합니다.

스케줄 `args`도 같은 rule을 따라야 합니다. 그렇지 않으면 「운영 Cron 인자 불법」:

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
Cron `args`의 필드 이름은 options와 같아야 합니다. 다르면 트리거는 되다가 검증에서 실패합니다. 복잡한 구조는 하나의 string에 넣고 `JSON.parse`하지 말고 평탄한 필드로 나누세요. help와 검증 모두 불리합니다.
:::

운영/CI: Cron이 주입하는 args는 수동 스크립트와 같은 옵션 이름을 씁니다. 로컬에서는 `--help`로 필드를 맞추고, 실패 시 종료 코드와 검증 메시지를 확인하세요.

## 다음 단계

- 명령 구성: [명령 라우팅](/ko/console/commander)
- rule 체인: [공통 체이닝](/ko/validators/chain), [검증기 개요](/ko/validators/)
- 스케줄 인자: [Cron](/ko/plugins/cron)