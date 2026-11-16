---
outline: deep
---

# Console 앱 진입점

터미널에서 실행하는 명령 진입점을 만듭니다. Web과 **같은** services·검증기를 쓰지만 무대는 `aomex <명령>`입니다. 마이그레이션, 캐시 예열, OpenAPI 내보내기, Cron에 적합합니다. 끝나면 종료하고 HTTP 포트를 점유하지 않습니다.

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

`ctx.logger`에 자동 완성이 있습니다(Web과 같이 마운트한 서비스·미들웨어에서). 이후 `options({ ... })`를 붙이면 `ctx.options`가 선언한 형태로 좁혀집니다. `app.run()`은 **종료 코드**를 반환합니다(0이 성공). 프레임워크가 `process.exit`를 대신 호출하지 않아 테스트에서 단언하기 쉽습니다.

::: warning
실패 시 종료 코드 0으로 조용히 return하지 마세요. CI는 성공으로 처리합니다. throw하거나 `run`이 0이 아닌 코드를 받도록 하세요.
:::

## `run`에 하위 명령 전달

`app.run()`은 한 명령을 파싱·실행하고 종료 코드를 반환합니다. 인자 없으면 `process.argv`를 읽습니다(터미널의 `npx aomex cache:warm`과 같음). 테스트·스크립트에서는 argv를 바꾸지 않고 명령 이름과 인자를 직접 넘길 수 있습니다:

```typescript
await app.run();
await app.run('cache:warm');
await app.run('export', '--out', 'a.csv');
```

## language

CLI에는 **Accept-Language**가 없습니다. `language`는 문자열(`zh-CN`, `en-US` 등)만 가능하며 Web의 fixed와 같습니다: `options()` 검증 실패·프레임워크 메시지가 그 로케일로 나갑니다. Web처럼 `{ mode, header }` 객체를 넘기지 마세요.

```typescript
new ConsoleApp({
  services,
  logger: services.logger,
  language: 'zh-CN', // [!code highlight]
  mount: [commanders('./src/commanders')],
});
```

로케일 코드는 하이픈(`zh-CN`)을 쓰고 밑줄(`zh_CN`)은 쓰지 마세요. Web에서 요청 헤더 협상은 [Web 앱 진입점 · language](/ko/web/#language)를 보세요. 제품 문구는 [고급: 제품 i18n](/ko/advanced/i18n)입니다.

## Web과 비교

| | Web | Console |
| --- | --- | --- |
| 매칭 | method + path | 명령 이름 |
| 입력 | query / body / params | `options()` |
| 언어 | 요청마다 협상 가능 | 고정만 |
| 수명 | listen + 종료 신호 | `run` 끝나면 종료 |

비즈니스 service·mixin 미들웨어는 양쪽에 걸 수 있습니다. 운영성 작업은 보통 Console에 둡니다. DB·외부 호출은 Web과 같이 `services/`에 두고 HTTP와 CLI에 각각 두 벌 두지 마세요.

## 다음 단계

- [명령 라우팅](/ko/console/commander)
- [입력 옵션](/ko/console/options)
- [OpenAPI 내보내기](/ko/console/openapi)
- [Cron](/ko/plugins/cron)