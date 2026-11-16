---
outline: deep
---

# 명령 라우팅

Console에 HTTP의 method + path가 아니라 동사 구 명령(예: `cache:warm`)을 정의합니다. 여러 명령이 하나의 Commander와 prefix를 공유할 수 있으며, Web의 Router + `routers()` 구조와 대칭입니다.

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
    await ctx.logger.info(`warming ${ctx.options.key ?? 'all'}`);
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

`options({ ... })`를 걸면 `ctx.options` 형태가 필드 표와 일치합니다(Web의 query/body와 같은 rule). `create`의 `action` 반환값은 프로세스 종료 의미에 참여하고, 비동기 오류는 프레임워크 규칙에 따라 실패 종료 코드로 전파됩니다.

create 서명 요점:

```typescript
commander.create(commandName | string[], {
  disabled?: boolean;
  mount?: ConsoleMiddleware[];
  docs?: { summary?: string; description?: string };
  action: (ctx) => any;
});
```

명령 이름은 생성자 `prefix`와 이어집니다. `disabled: true`이면 등록되지 않습니다(환경별로 기능을 끄고 롤백하기 좋습니다).

## prefix

`prefix`는 명령 이름 접두사입니다. `new Commander({ prefix: 'cache:' })` 다음 `create('warm')`이면 외부에서는 `aomex cache:warm`입니다. 도메인별로 (`cache:`, `user:`) 나누면 파일 간 이름 충돌을 줄이고 `--help`에서 관련 명령을 한눈에 볼 수 있습니다.

어느 명령과도 맞지 않으면 애플리케이션은 보통 **0이 아닌 종료 코드**로 끝나고 도움말을 출력합니다. CI에서는 stdout만 보지 말고 종료 코드를 검증하세요. `ConsoleApp.mount`에 `commanders(...)`를 빼먹으면 파일에 명령을 써도 CLI에 나타나지 않습니다.

## commanders 등록

| 조직 습관 | 설명 |
| --- | --- |
| `commanders('./dir')` | 디렉터리가 등록표; import 유지 부담 적음 |
| `commanders([a, b])` | 테스트나 일부만 마운트 |
| 도메인당 한 파일 | `cache.commander.ts`, `user.commander.ts` |
| Cron과 공유 | 스케줄과 수동 실행이 같은 파일·`action`; Cron `args`도 같은 `options()`를 거침 — [Cron](/ko/plugins/cron) |
| OpenAPI 내보내기 | `openapi()`와 `commanders()`를 Console `mount`에 함께 — [OpenAPI 내보내기](/ko/console/openapi) |

## docs와 disabled

`docs`는 `--help` 요약에 들어가고, options의 `docs`와 보완합니다. 예전·새 스크립트 이름이 공존할 때는 commandName 배열(`flush` / `clear`)을 씁니다.

기능 플래그:

```typescript
commander.create('sync', {
  disabled: process.env['FEATURE_SYNC'] !== '1', // [!code highlight]
  action: async (ctx) => {
    await runSync();
  },
});
```

## 다음 단계

- 옵션 검증: [입력 옵션](/ko/console/options)
- 스케줄: [Cron](/ko/plugins/cron)
- 진입점과 종료 코드: [Console 앱](/ko/console/)