---
outline: deep
---

# API 라우트

`src/routers`에서 도메인별로 파일을 나누고, 파일마다 Router를 export한 뒤 get / post로 action을 등록합니다. WebApp mount에는 `routers('./src/routers')`로 한 번에 겁니다.

```typescript
// src/routers/user.ts
import { Router } from '@aomex/web';

export const router = new Router();

const users = [
  { id: 1, name: 'Ada' },
  { id: 2, name: 'Bob' },
];

router.get('/users', { // [!code focus:5]
  action: async (ctx) => {
    ctx.send(users);
  },
});

router.get('/users/count', {
  action: async (ctx) => {
    ctx.send({ count: users.length });
  },
});
```

앱에 연결:

```typescript
import { routers, WebApp } from '@aomex/web';

new WebApp({
  // services、logger、language、proxyIP …
  mount: [routers('./src/routers')], // [!code highlight]
});
```

테스트나 기능 플래그일 때는 디렉터리 스캔 대신 구체 인스턴스를 넘길 수 있습니다:

```typescript
import { userRouter } from './routers/user.js';
import { postRouter } from './routers/post.js';

mount: [routers([userRouter, postRouter])],
```

라우트 mount에 query() / body() / params() / response()를 걸면 action의 ctx에 해당 필드 타입이 합쳐집니다. **메서드 수준** mount는 현재 API만, **라우트 수준** `Router({ mount: [...] })`는 파일 안 모든 메서드에 적용됩니다.

```typescript
router.get('/users', { // [!code focus:11]
  mount: [
    middleware.web<{ tenant: string }>(async (ctx, next) => { // [!code highlight]
      ctx.tenant = ctx.request.headers['x-tenant'] as string;
      await next();
    }),
  ],
  action: (ctx) => {
    ctx.tenant;
  },
});

router.get('/users/:id', {
  action: (ctx) => {
    ctx.tenant; // 类型上不存在
  },
});
```

## prefix

`Router({ prefix })`는 이 파일의 **모든** 등록 경로에 고정 접두사를 붙입니다. 매 `router.get`마다 `/users`를 쓰지 않게 합니다. `/v1` → `/v2` 전환이나 도메인별 URL 분리 시 생성자 인자 한 곳만 바꾸면 됩니다.

```typescript
import { rule } from '@aomex/common';
import { params, Router } from '@aomex/web';

export const router = new Router({ prefix: '/users' }); // [!code highlight]

router.get('/', { // [!code focus:5]
  action: async (ctx) => {
    ctx.send([]);
  },
});

router.get('/:id', {
  mount: [params({ id: rule.int().min(1) })],
  action: async (ctx) => {
    ctx.send({ id: ctx.params.id });
  },
});
```

최종 경로 = prefix + 등록 uri(여분 슬래시는 정규화). 404 디버깅 시 `router.get('/:id')`만 보지 말고 prefix를 붙인 전체 경로를 보세요.

OpenAPI 도메인 그룹은 `Router({ docs: { tags: ['User'] } })`. 단일 라우트 `docs.summary`로 덮어쓸 수 있습니다.

## 라우트 수준 mount

`Router({ mount: [...] })`는 파일 전체 메서드에 미들웨어를 겁니다. 묶음 전체에 로그인·감사·공통 query 기본값이 필요할 때 각 `router.get`마다 반복하지 않고 이 진입점을 씁니다.

파일 전체에 로그인·감사가 필요할 때:

```typescript
new Router({
  prefix: '/admin',
  mount: [auth.authenticate('bearer')],
});
```

라우트 수준 mount는 파일 **모든** 메서드에 적용됩니다. 공개 API와 로그인 필요 API를 한 Router에 넣지 마세요. 공개 페이지는 파일을 나누거나 메서드 수준 mount / skip을 쓰세요.

## 단일 라우트 mount, docs, disabled

**메서드 수준 mount**는 이 라우트만: 입력 검증(query / body / params / response), 단일 API 인증 등. 라우트 수준 mount와 겹치면 라우트 수준을 먼저 거친 뒤 메서드 수준으로 갑니다.

**disabled**는 런타임에 그 라우트를 **등록하지 않습니다**(매칭 안 됨, action도 안 탐). 환경 변수나 기능 플래그로 미완 API를 끄는 데 쓰며, 프로덕션에 501을 남기는 것보다 안전합니다.

**docs**는 이 라우트의 OpenAPI 설명(`summary` 등)입니다. `Router({ docs: { tags } })`가 그룹을 담당하고, 단일 라우트 docs로 제목·설명을 덮습니다. [response()](/ko/web/response)와 함께 문서 생성 시 계약에 스캔됩니다.

```typescript
import { rule } from '@aomex/common';
import { query, response, Router } from '@aomex/web';

router.get('/users', { // [!code focus:11]
  disabled: process.env['FEATURE_USERS'] !== '1', // [!code highlight]
  mount: [
    query({ page: rule.int().min(1).default(1) }),
    response({ statusCode: 200, content: rule.array({ id: rule.int() }) }),
  ],
  docs: { summary: '用户列表' }, // [!code highlight]
  action: async (ctx) => {
    ctx.send([]);
  },
});
```

OpenAPI 메타데이터는 [OpenAPI 플러그인](/ko/openapi/)을 보세요.

단일 경로 파라미터:

```typescript
router.get('/users/:id', {
  mount: [params({ id: rule.int().min(1) })], // [!code highlight]
  action: async (ctx) => {
    ctx.send({ id: ctx.params.id });
  },
});
```

경로 파라미터에 params()가 없으면 `ctx.request.params`는 전부 문자열이라 "1"과 1을 업무에서 섞기 쉽습니다.

## HTTP 메서드

`router.<method>(uri, { ... })`마다 HTTP 동사가 하나씩 묶입니다. 등록 순서는 매칭에 영향 없고, 정적·리터럴 경로가 `:param`보다 우선합니다.

| 메서드 | 설명 |
| --- | --- |
| `get` | `GET`. **HEAD**는 같은 이름의 `GET`과 매칭 공유 |
| `post` / `put` / `patch` / `delete` | 해당 동사 |
| `all` | 위 동사 전부 |
| `customize` | 동사 배열 직접 선택 |

`customize`는 한 경로에서 여러 동사를 동시에 받습니다(GET 검증, POST 접수 등). `get` / `post`를 각각 등록하면 라우트가 둘이 되고 관리도 어렵습니다. 서드파티 웹훅, 헬스체크 겸 프로브에 자주 씁니다.

웹훅에 customize 사용:

```typescript
router.customize(['GET', 'POST'], '/webhook', { // [!code highlight]
  action: async (ctx) => {
    ctx.send({ ok: true });
  },
});
```

## 경로 표기

uri 등록 시 **리터럴 세그먼트**가 `:param`보다 우선하므로 `/users/count`는 `/:id`에 삼키지 않습니다. 이름 있는 파라미터 키는 `params()` 필드와 같아야 합니다.

| 표기 | 의미 |
| --- | --- |
| `/users/:id` | 이름 파라미터 `id` |
| `/users/count`와 `/users/:id` 공존 | 리터럴 우선, `:id`가 count를 먹지 않음. 등록 순서에 기대지 말고 정적 세그먼트를 쓸 수 있으면 쓰세요 |

glob으로 디렉터리를 스캔할 때는 Router export만 두면 «왜 등록 안 됐는지» 찾기 쉽습니다. 잡파일이 많으면 어렵습니다.

## 다음 단계

- [Web 앱 진입점](/ko/web/): WebApp과 사이트 mount
- [쿼리 문자열](/ko/web/query): GET 필터·페이징
- [경로 파라미터](/ko/web/params), [요청 본문](/ko/web/body)
