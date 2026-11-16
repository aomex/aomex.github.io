---
outline: deep
---

# CORS

브라우저 프론트엔드가 API를 합법적으로 호출할 수 있게 합니다. 개발 환경에서는 포트가 나뉘어 preflight가 필요할 수 있고, 프로덕션에서는 허용할 **origin**을 조여야 하며, Cookie를 쓰려면 **credentials**를 맞춰야 합니다.

```bash
pnpm add @aomex/cors
```

## routers 앞에

`cors()`는 미들웨어 단계에서 `Access-Control-*` 헤더를 써서 브라우저가 교차 출처 응답을 읽게 합니다. `routers` **앞**에 마운트해야 4xx/5xx를 포함한 모든 응답에 헤더가 붙습니다. 그렇지 않으면 preflight는 통과해도 오류 본문을 읽지 못합니다.

```typescript
import { cors } from '@aomex/cors';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    cors(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

::: warning
CORS를 `routers` **뒤**에 두면 404나 검증 400 응답에 헤더가 빠질 수 있고, 브라우저의 「CORS 오류」가 진짜 원인을 가립니다.
:::

로컬에서 프론트·백이 포트가 다를 때 인자 없는 `cors()`는 요청 `Origin`을 그대로 돌려주는 경우가 많아 개발에는 충분합니다. 배포 시에는 도메인을 명시하세요.

`cors()`는 일반 `WebMiddleware`이며 `ctx`에 새 필드를 붙이지 않습니다. action은 그대로 두고 교차 출처는 응답 헤더로 처리됩니다. 성공 시 `Access-Control-Allow-Origin`이 보이고, Cookie를 쓰려면 `Access-Control-Allow-Credentials: true`가 필요하며 **`origin: '*'`는 쓸 수 없습니다**.

## Origin·자격 증명 조이기

| 옵션 | 언제 쓰나 | 기본값 |
| --- | --- | --- |
| `origin` | 프로덕션 고정 프론트 도메인, 또는 여러 프론트용 함수 화이트리스트 | 요청 `Origin` 반영 |
| `credentials` | 교차 출처 Cookie / 인증 헤더 | — |
| `allowHeaders` | `Authorization` 같은 커스텀 헤더 | — |
| `exposeHeaders` | `X-Request-Id` 등 응답 헤더를 JS에서 읽기 | — |
| `maxAge` | OPTIONS 반복 줄이기; 디버그 시 `-1`로 캐시 끄기 | `3600` |
| `allowMethods` | GET/POST만 열 때 | 일반적인 메서드 집합 |
| `secureContext` / `privateNetworkAccess` | 격리 페이지, 공개 사이트에서 사설 API(Chrome PNA) | `false` |

### 프로덕션: Cookie + 단일 프론트

```typescript
cors({
  origin: 'https://app.example.com', // [!code highlight]
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-Request-Id'],
});
```

::: warning
`credentials: true`일 때 **`origin: '*'`를 쓸 수 없습니다**. 브라우저가 거부합니다.
:::

### 프로덕션: 여러 프론트 origin

```typescript
const allowlist = new Set([
  'https://app.example.com',
  'https://admin.example.com',
]);

cors({
  origin: (ctx) => { // [!code highlight]
    const origin = ctx.request.headers['origin'];
    if (origin && allowlist.has(origin)) {
      return origin;
    }
    return false;
  },
  credentials: true,
});
```

| 환경 | 권장 |
| --- | --- |
| 로컬 | 인자 없는 `cors()` 또는 화이트리스트에 `http://localhost:5173` |
| 프로덕션 | 임의 `Origin` 반영 금지; `credentials` 사용 시 origin은 구체적 도메인 |

프로덕션에서 기본 반영은 API를 모든 사이트에 노출하는 것과 같고 Cookie와 겹치면 더 위험합니다. Web API만 바꾸고 문서/Swagger/관리 콘솔 origin을 빼면 해당 도메인에서 preflight가 실패합니다.

## 다음 단계

- 마운트 순서와 양파 모델: [미들웨어](/ko/core/middleware)
- 보안 응답 헤더(CORS와 같이 두는 경우 많음): [Helmet](/ko/plugins/helmet)
- 전역 관측: [HTTP 액세스 로그](/ko/plugins/http-access-log)