---
outline: deep
---

# CSRF 보호

브라우저는 동일 사이트 Cookie를 자동으로 붙입니다. 공격자 페이지가 당신 브라우저로 API에 POST를 유도하면 **HttpOnly 로그인 Cookie도 함께 실립니다**——이것이 교차 사이트 요청 위조입니다. `@aomex/csrf`는 **더블 서브밋 Cookie**: 서버가 읽을 수 있는 `csrfToken` Cookie를 발급하고, 프론트가 같은 값을 요청 헤더에 넣습니다. 양쪽이 같을 때만 쓰기를 통과시킵니다.

[Session](/ko/plugins/auth-session-strategy)과 거의 항상 짝입니다. Bearer 헤더만 쓰고 Cookie 로그인에 의존하지 않으면 보통 CSRF는 필요 없습니다.

```bash
pnpm add @aomex/csrf
```

## routers 앞에 걸기

인자 없는 `csrf()`로 충분합니다. GET/HEAD/OPTIONS는 Cookie 발급·재사용만 하고 헤더는 검사하지 않습니다. POST 등 쓰기는 Cookie와 `x-csrf-token`이 같아야 하며, 아니면 **403**.

```typescript
import { cors } from '@aomex/cors';
import { csrf } from '@aomex/csrf';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'ko-KR' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:5]
    cors({ origin: 'https://app.example.com', credentials: true }),
    csrf(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

::: warning
반드시 routers **앞**에 두세요. 검증 실패가 오류 미들웨어로 갈 때 csrf가 뒤에 있으면 방금 발급한 `Set-Cookie`가 브라우저에 안 닿아 프론트가 계속 token이 없을 수 있습니다.
:::

미들웨어는 ctx에 `csrfToken`(현재 token 문자열)을 붙입니다. Cookie는 **강제** `httpOnly: false`(더블 서브밋은 JS가 읽어야 함). 나머지 속성(`sameSite` / `path` / `maxAge`)은 설정 가능하며 기본은 `setCookie`와 같습니다(`SameSite=Strict` 포함).

로그인 Cookie도 교차 출처로 보낼 때 CORS는 `credentials: true`와 **명시적** `origin`, `allowHeaders`에 `x-csrf-token`. [CORS](/ko/plugins/cors)와 [Session](/ko/plugins/auth-session-strategy) 참고.

## 프론트에서 붙이는 법

1. 아무 GET(또는 페이지 로드)으로 응답에 `Set-Cookie: csrfToken=...`
2. `document.cookie`(또는 cookie 헬퍼)로 값 읽기
3. 쓰기에 헤더 `x-csrf-token: <같은 값>`. 로그인 Cookie도 쓰면 `credentials: 'include'`

```typescript
function readCsrfToken() {
  const row = document.cookie
    .split('; ')
    .find((line) => line.startsWith('csrfToken='));
  return row?.slice('csrfToken='.length);
}

await fetch('/api/orders', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': readCsrfToken()!, // [!code highlight]
  },
  body: JSON.stringify({ sku: 'A1' }),
});
```

Cookie 없이 바로 POST하면 **403**. 다만 응답에 새 `Set-Cookie`가 붙을 수 있으니 읽고 재시도하면 됩니다.

## 옵션과 건너뛰기

| 옵션 | 언제 쓰는지 | 기본 |
| --- | --- | --- |
| `cookie.name` | 기존 프론트 약속에 맞춤 | `csrfToken` |
| `cookie.sameSite` / `path` / `maxAge` / `secure` | 교차 사이트, 경로 분리, 만료 | `setCookie`와 같음. `httpOnly`는 항상 `false` |
| `headerName` | 프론트가 다른 헤더 이름 사용 | `x-csrf-token` |
| `ignoreMethods` | 검사하지 않을 메서드 | `GET`, `HEAD`, `OPTIONS` |
| `ignore` | 헬스 체크, 외부 webhook 등 요청 단위 건너뛰기 | — |

```typescript
csrf({
  cookie: { sameSite: 'lax', maxAge: 86400 },
  headerName: 'x-xsrf-token',
  ignore: (ctx) => {
    return ctx.request.pathname.startsWith('/webhooks/');
  },
});
```

Header + Cookie만 읽고 **body는 읽지 않아** `body()` 파싱과 간섭하지 않습니다. Webhook 등 비브라우저 장면은 `ignore`로 통과시키고, CSRF를 전역으로 끄지 마세요.

## 관련

- [Session 전략](/ko/plugins/auth-session-strategy)
- [CORS](/ko/plugins/cors)
- [Helmet](/ko/plugins/helmet)
