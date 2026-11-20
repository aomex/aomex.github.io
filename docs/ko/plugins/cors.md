---
outline: deep
---

# 교차 출처 CORS

브라우저 프론트엔드가 API를 합법적으로 호출할 수 있게 합니다. 개발에서는 포트가 나뉘어 preflight가 필요할 수 있고, 프로덕션에서는 허용할 origin을 조이며, Cookie가 필요하면 credentials도 맞춥니다.

```bash
pnpm add @aomex/cors
```

## routers 앞에 걸기

`cors()`는 미들웨어 단계에서 Access-Control-* 응답 헤더를 써서 브라우저가 교차 출처로 본문을 읽게 합니다. 반드시 `routers` **앞**에 두어 전 응답(4xx/5xx 포함)에 헤더가 붙게 하세요. 뒤에 두면 preflight는 통과해도 업무 오류 시 프론트가 오류 본문을 못 읽습니다.

```typescript
import { cors } from '@aomex/cors';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'ko-KR' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    cors(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

::: warning
CORS를 routers **뒤**에 두면 404·검증 400에서 헤더가 빠질 수 있습니다. 브라우저 「CORS 오류」가 진짜 원인을 가립니다.
:::

로컬에서 포트가 나뉘고 **Cookie를 안 보낼 때**는 인자 없는 cors()가 요청 Origin을 반영해 대개 충분합니다. 교차 출처로 Cookie를 보내면([Session](/ko/plugins/auth-session-strategy)) 다음 절처럼 origin을 명시하세요.

cors()는 일반 WebMiddleware이며 ctx에 새 필드를 붙이지 않습니다. 업무 action은 그대로. 성공 시 Access-Control-Allow-Origin이 보이고, Cookie를 쓰면 Access-Control-Allow-Credentials: true도 필요하며 **origin: '*'는 쓸 수 없습니다**.

## Origin과 자격 증명 조이기

| 옵션 | 언제 쓰는지 | 기본 |
| --- | --- | --- |
| `origin` | 프로덕션에서 프론트 도메인 고정, 또는 화이트리스트 / 함수 | credentials 끄면 요청 `Origin` 반영; **켜면 필수** |
| `credentials` | 교차 출처 Cookie / 클라이언트 인증서 등 | `false` |
| `allowHeaders` | `Authorization`, `x-csrf-token` 등 | — |
| `exposeHeaders` | 프론트가 `X-Request-Id` 등을 읽음 | — |
| `maxAge` | OPTIONS 반복 감소. 디버그는 `-1`로 캐시 없음 | `3600` |
| `allowMethods` | GET/POST만 열 때 | 흔한 동사 집합 |
| `secureContext` / `privateNetworkAccess` | 격리 페이지, 공개 사이트에서 내부망 API(Chrome PNA) | `false` |

### Cookie 로그인: origin 명시 필수

`credentials: true`(또는 함수가 `true` 반환)일 때:

- **필수**: `origin` 명시(구체 도메인, 화이트리스트 배열, 구체 origin을 반환하는 함수)
- **금지**: 인자 없는 cors()의 기본 반영——빠지면 생성 또는 요청 단계에서 예외
- **금지**: `origin: '*'`(브라우저도 이 조합을 인정하지 않음)

```typescript
cors({
  origin: 'https://app.example.com', // [!code highlight]
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
  exposeHeaders: ['X-Request-Id'],
});
```

::: warning
credentials를 켜고 origin을 안 쓰거나 `*`로 쓰면 앱이 안 뜨거나 요청에서 예외가 납니다. 「임의 Origin 반영 + Cookie」라는 위험한 기본값을 의도적으로 막습니다.
:::

Session은 [CSRF](/ko/plugins/csrf)도 함께 걸고, 프론트 `fetch`는 `credentials: 'include'`. 전체 흐름은 [Session 전략](/ko/plugins/auth-session-strategy).

### 여러 프론트 화이트리스트

```typescript
const allowlist = [
  'https://app.example.com',
  'https://admin.example.com',
];

cors({
  origin: allowlist, // [!code highlight]
  credentials: true,
  allowHeaders: ['Content-Type', 'x-csrf-token'],
});
```

함수로 요청마다 구체 origin을 반환할 수도 있습니다(화이트리스트 적중 시만. 미적중은 `undefined`로 CORS 비활성):

```typescript
cors({
  origin: (ctx) => {
    const origin = ctx.request.headers['origin'];
    if (typeof origin === 'string' && allowlist.includes(origin)) {
      return origin;
    }
    return undefined;
  },
  credentials: true,
});
```

| 환경 | 권장 |
| --- | --- |
| 로컬(Cookie 없음) | 인자 없는 `cors()` |
| 로컬(Session) | `origin: 'http://localhost:5173'` + `credentials: true` |
| 프로덕션 | 명시 도메인 또는 화이트리스트. credentials 켤 때 기본 반영 금지 |

Web API만 고치고 문서 사이트 / Swagger / 관리 콘솔 origin을 잊으면 그 도메인에서 preflight가 실패합니다.

## 다음 단계

- Cookie 로그인 전체 흐름: [Session 전략](/ko/plugins/auth-session-strategy)
- 쓰기 위조 방지: [CSRF](/ko/plugins/csrf)
- 마운트 순서와 양파 모델: [미들웨어](/ko/core/middleware)
- 보안 응답 헤더(CORS와 자주 나란히): [Helmet](/ko/plugins/helmet)
- 전역 관측: [HTTP 액세스 로그](/ko/plugins/http-access-log)
