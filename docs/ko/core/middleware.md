# 미들웨어

요청 진입 시(또는 핸들러 후) 로직을 실행하고 `ctx`에 필드(예: `requestId`)를 노출해 downstream action이 쓰게 합니다.

미들웨어는 함수입니다. `await next()`를 호출해야 요청이 계속됩니다. `next` 전후에 코드를 둘 수 있습니다.

```typescript
import { middleware } from '@aomex/common';

export const withRequestId = middleware.mixin<{
  readonly requestId: string;
}>(async (ctx, next) => { // [!code highlight]
  ctx.requestId = crypto.randomUUID();
  await next();
});
```

::: warning
뒤쪽 미들웨어·비즈니스는 `await next()`에 의존합니다. 인증 실패로 끊을 때는 생략할 수 있지만 실수로 빼먹지 마세요. 반드시 **await next()** — 아니면 downstream async 오류가 처리되지 않은 rejection이 됩니다.
:::

`middleware.mixin<{ … }>`로 새 `ctx` 필드를 선언하면 **뒤 미들웨어·같은 라우트 action**에 자동 완성이 붙습니다. 제네릭 없이 런타임만 대입하면 TypeScript는 여전히 없는 것으로 봅니다.

```typescript
// action 里
async (ctx) => { // [!code highlight]
  await services.logger.info('请求', { requestId: ctx.requestId });
  return { ok: true };
};
```

여러 미들웨어 mixin 필드는 같은 `ctx` 타입에 합쳐집니다. 런타임만 필드를 달고 mixin 제네릭이 없으면 돌아가지만 타입이 도와주지 않아 이름 변경 시 놓치기 쉽습니다.

## WebApp.mount

`WebApp.mount`는 사이트 양파 스택입니다. CORS, 액세스 로그, formatError, `routers(...)`가 배열 순서로 실행됩니다. 앞쪽일수록 바깥 레이어, `await next()`로 뒤 전체를 감쌉니다.

```typescript
import { WebApp } from '@aomex/web';
import { routers } from '@aomex/web';
import { withRequestId } from './middlewares/request-id.js';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:2]
    withRequestId, // [!code highlight]
    routers('./src/routers'),
  ],
});
```

CORS, 사이트 전역 requestId, 액세스 로그 등 「모든 요청」은 `WebApp.mount` / `ConsoleApp.mount`.

## Router.mount

URL 그룹이 같은 로직(인증, 감사, prefix formatError)을 공유할 때 `Router({ mount })` — 이 파일 경로만, WebApp으로 전체를 감쌀 필요 없음.

```typescript
import { Router } from '@aomex/web';

// 某一组资源都要登录（auth 为项目里配好的 Auth 实例）
new Router({ prefix: '/admin', mount: [auth.authenticate('bearer')] });
```

특정 리소스 그룹 통합 인증은 Router.mount; 공개는 다른 Router(같은 Router에 skip 남발 금지).

## 라우트별 mount

한 라우트 `mount`는 그 action 전만 실행: 해당 body/query, 더 엄한 authorize, 공개·보호가 같은 Router일 때 예외. 일상 검증은 query/body/cors/auth 내장을 우선, 매번 custom middleware 불필요.

```typescript
import { rule } from '@aomex/common';
import { body } from '@aomex/web';

router.post('/login', { // [!code focus:11]
  mount: [
    body({ // [!code highlight]
      email: rule.email(),
      password: rule.string(),
    }),
  ],
  action: async (ctx) => {
    ctx.send({ token: '...' });
  },
});
```

## skip으로 일부 요청 건너뛰기

소수 경로·환경에서 전체 미들웨어를 생략(헬스 체크 무인증, 테스트에서 레이어 끔)할 때 기존 미들웨어에 `.skip(...)` 체인. 조건 `true`면 원 로직 없이 `next()` — `mount` 복제보다 유지보수 쉬움.

**함수**(요청마다) 또는 **`boolean`**(컴파일 시 고정) 가능:

```typescript
const authMaybe = auth.authenticate('bearer').skip((ctx) => { // [!code highlight]
  return ctx.request.pathname === '/health';
});

// 测试环境整层关掉：不必再包一层函数
const accessLogMaybe = accessLog().skip(process.env['NODE_ENV'] === 'test');

// 临时禁用某层（等价于挂 mount 时先拿掉）
someMiddleware.skip(true);
```

::: warning
`.skip()`은 **Props 타입을 바꾸지 않음**: 인증을 skip해도 `ctx.auth`는 타입상 있는 것처럼 보입니다 — action에서 미인증 분기 직접 처리. 공개 엔드포인트가 많으면 skip 체인보다 **무인증 Router** 분리.
:::

## `dependsOn`으로 upstream 타입 빌리기

앞에 어떤 레이어(인증, `userId` 미들웨어)가 **이미** 실행됐다고 가정하고 `fn`에서 필드를 쓰되 upstream을 다시 실행하지 않으려면 `middleware.dependsOn(上游).web(...)` / `.mixin(...)` / `.console(...)`.

`dependsOn`은 **타입만**: 넘긴 미들웨어를 런타임 실행하지 않음. 실행은 mount 순서의 실제 upstream.

```typescript
import { middleware } from '@aomex/common';

const withUser = middleware.web<{ userId: number }>(async (ctx, next) => {
  ctx.userId = Number(ctx.request.headers['x-user-id']);
  await next();
});

// 假定上游已挂 withUser：这里能补全 ctx.userId，但不会再跑一遍 withUser
export const loadProfile = middleware.dependsOn(withUser).web(async (ctx, next) => { // [!code highlight]
  const profile = await services.user.getProfile(ctx.userId);
  ctx.send(profile);
  await next();
});
```

mount 시 upstream을 앞에 둡니다:

```typescript
router.get('/me', {
  mount: [withUser, loadProfile], // [!code highlight]
  action: async () => {},
});
```

팩토리 / `async` 팩토리도 가능(`combineServices`처럼, 여기서도 타입용). `dependsOn` 여러 번 체인하면 필드가 쌓입니다.

::: tip
`Middleware.Infer<typeof loadProfile>`는 `dependsOn`으로 빌린 Props **포함 안 함** — 밖에서는 이 미들웨어가 ctx에 안 더한 것처럼 보입니다. 빌림은 `fn`(그리고 바로 다음 `.skip(ctx => …)`) 안의 `ctx`만.
:::

일상은 query, body, cors, auth 내장 우선. OpenAPI / CLI help 훅은 [사용자 정의 미들웨어](/ko/advanced/middleware).

## 다음 단계

- 검증·400: [요청 본문](/ko/web/body), [쿼리 문자열](/ko/web/query)
- 인증: [Auth](/ko/plugins/auth)
- OpenAPI / Help: [사용자 정의 미들웨어](/ko/advanced/middleware)
