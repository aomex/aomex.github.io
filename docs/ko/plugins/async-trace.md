---
outline: deep
---

# 비동기 추적

액세스 로그는 「이 요청이 800ms」를 알려 줍니다. **어떤 await가 시간을 썼는지** 보려면 요청 안에 트리를 만드세요—느린 라우트와 서비스 IO 체인 프로파일에 좋습니다. 일상 CRUD에는 생략하고, 표준 분산 추적은 OpenTelemetry—이 패키지는 가볍고 프로세스 내입니다.

## 전체 요청 traceMiddleware

필요할 때 설치:

```bash
pnpm add @aomex/async-trace
```

전체 요청을 감쌉니다:

```typescript
import { asyncTrace, traceMiddleware } from '@aomex/async-trace';

mount: [
  traceMiddleware('request', (record) => { // [!code highlight]
    if (record.duration > 500) {
      void asyncTrace.toStack([record]);
    }
  }),
  routers('./src/routers'),
],
```

`traceMiddleware` 없이는 런타임·타입 모두 `ctx.asyncTrace`가 없습니다—마운트하거나 로컬 `traceBlock`만 쓰세요.

서비스 안 로컬 블록:

```typescript
import { traceBlock } from '@aomex/async-trace';

const data = await traceBlock('loadUser', async () => { // [!code highlight]
  const profile = await db.profile.find();
  const prefs = await db.prefs.find();
  return { profile, prefs };
});
```

메서드 데코레이터(await가 많을 때 수동 `traceBlock`보다 깔끔):

```typescript
import { traceMethod } from '@aomex/async-trace';

class UserService {
  @traceMethod() // [!code highlight]
  async load() {
    return [];
  }
}
```

라벨 없으면 기본은 `ClassName.methodName`처럼 스택에서 읽기 쉽습니다.

`traceMiddleware` 이후 Web 컨텍스트에 **AsyncTraceMiddlewareProps**가 합쳐집니다. 요청에서 **ctx.asyncTrace.record**를 씁니다(필드는 타입 힌트). `traceMiddleware`는 **mixin** 미들웨어—`middleware.web` 전용이 아니며 Web mount에 맞고 Console / command mount에도 가능합니다. `asyncTrace.run(label, callback)`는 자식 노드를 열고, 중첩 `toStack`은 들여쓰기 구조로 출력합니다. 기록은 보통 label, duration, parent/children, error—디버깅에 duration과 label만으로 충분한 경우가 많습니다.

## 마운트 레벨과 콜백

| 시나리오 | 용법 |
| --- | --- |
| HTTP 사이트 전체 | `WebApp.mount: [traceMiddleware('http')]` |
| API 그룹 하나 | `Router.mount: [traceMiddleware('api-v1')]` |
| 콘솔 작업 | `ConsoleApp` / command `mount` |
| 핫 메서드 | `@traceMethod()` 또는 `traceBlock` |
| 느린 요청 로그 | `traceMiddleware` 두 번째 인자 `callback`—프로덕션 핫 경로에서 무조건 전체 스택 금지 |

::: warning
프로덕션에서 스택 전량 덤프는 CPU 비용이 큽니다. 로깅으로 보내기 전 콜백에서 임계값·샘플링하세요.
:::

[@aomex/http-access-log](/ko/plugins/http-access-log)와 보완: 액세스 로그=총 시간, 추적=하위 단계. 크로스 서비스 추적은 OpenTelemetry를 대체하지 않습니다.

## 관련

- 미들웨어 순서: [Web 앱](/ko/web/), [커스텀 미들웨어](/ko/advanced/middleware)
- 로그의 requestId: [로거 · withBindings](/ko/core/logger#request-scoped-context-withbindings)