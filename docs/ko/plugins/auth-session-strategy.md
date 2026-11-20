---
outline: deep
---

# Session 전략

브라우저 로그인 상태를 **HttpOnly Cookie**에 둡니다. Cookie에는 불투명한 `sessionId`만 넣고, 사용자 데이터는 `@aomex/cache` 어댑터(memory / Redis)에 둡니다. SPA가 교차 출처이면 [CORS](/ko/plugins/cors)(Cookie 전송)와 [CSRF](/ko/plugins/csrf)(교차 사이트 쓰기 방지)도 함께 맞춰야 합니다——하나라도 빠지면 로그인 상태가 안 실리거나 제3자 사이트에 악용되기 쉽습니다.

「동일 출처 또는 신뢰할 프론트 + 서버에서 언제든 세션 폐기」에 맞습니다. 순수 모바일 / 머신 호출은 [Bearer](/ko/plugins/auth-bearer-strategy)나 [JWT](/ko/plugins/auth-jwt-strategy)가 더 흔합니다.

## 설치

Session 전략은 `@aomex/auth` 본체에 포함됩니다. 세션 저장에는 `@aomex/cache`(및 프로덕션 Redis 어댑터)가 필요합니다. 교차 출처 Cookie면 CORS / CSRF도 추가하세요.

```bash
pnpm add @aomex/auth @aomex/cache
# 교차 출처 Cookie：pnpm add @aomex/cors @aomex/csrf
# 다중 인스턴스 세션 공유：pnpm add @aomex/cache-redis-adapter
```

```typescript
import { AuthSessionStrategy } from '@aomex/auth/session';
```

## 먼저 CORS와 CSRF를 걸기

교차 출처 프론트가 Cookie를 보내려면 브라우저가 다음을 요구합니다:

1. 요청에 `credentials: 'include'`(또는 XHR `withCredentials`)
2. 응답에 `Access-Control-Allow-Credentials: true`, 그리고 `Access-Control-Allow-Origin`이 **구체 도메인**( `*` 불가)
3. 쓰기 요청에 CSRF 헤더. 없으면 다른 페이지가 당신 Cookie를 「빌려」POST할 수 있음

`credentials: true`일 때는 **`origin`을 반드시 명시**해야 합니다. 인자 없는 cors()의 기본 반영에 의존할 수 없습니다——시작 시 예외가 납니다. CSRF는 더블 서브밋 Cookie: 읽을 수 있는 Cookie `csrfToken`과 헤더 `x-csrf-token`이 같을 때만 통과합니다.

```typescript
import { cors } from '@aomex/cors';
import { csrf } from '@aomex/csrf';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'ko-KR' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:8]
    cors({
      origin: 'https://app.example.com',
      credentials: true,
      allowHeaders: ['Content-Type', 'x-csrf-token'],
    }),
    csrf(),
    routers('./src/routers'),
  ],
});
```

::: tip
로컬에서 포트가 나뉘면 origin을 `http://localhost:5173`(또는 프론트 주소)로 두고 `*`는 쓰지 마세요. 동일 출처 배포면 cors()는 생략할 수 있지만 CSRF는 그대로 두는 편이 좋습니다.
:::

마운트 순서: cors → csrf → routers. 둘 다 routers **앞**에 두어야 오류 응답에도 CORS / 방금 발급한 CSRF Cookie가 붙습니다.

프론트 갱신 요청 예:

```typescript
const csrfToken = document.cookie
  .split('; ')
  .find((row) => row.startsWith('csrfToken='))
  ?.split('=')[1];

await fetch('https://api.example.com/api/posts', {
  method: 'POST',
  credentials: 'include', // [!code highlight]
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken!, // [!code highlight]
  },
  body: JSON.stringify({ title: 'hi' }),
});
```

GET 등 안전 메서드는 기본으로 CSRF를 검사하지 않습니다. 첫 방문 시 `csrfToken` Cookie를 발급합니다(`HttpOnly=false`, JS가 읽을 수 있음). 자세한 내용은 [CSRF](/ko/plugins/csrf).

## store, cookie, onLoaded

`cookie.maxAge`(초)는 필수이며 캐시 TTL도 됩니다. `onLoaded`는 cache에 넣은 Stored를 업무 신원으로 바꿉니다. 탈퇴한 사용자는 `false` → **401**.

```typescript
import { Auth } from '@aomex/auth';
import { AuthSessionStrategy } from '@aomex/auth/session';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import { body, Router } from '@aomex/web';
import { rule } from '@aomex/common';

const auth = new Auth({
  strategies: {
    session: new AuthSessionStrategy({
      store: new CacheMemoryAdapter(), // [!code highlight]
      cookie: {
        maxAge: 7 * 24 * 3600,
        // 프로덕션 교차 사이트 프론트에서 흔함: sameSite: 'none', secure: true
      },
      onLoaded: async (data: { userId: number }) => {
        const user = await findActiveUser(data.userId);
        return user ?? false;
      },
      onAuthorize(minRole: number) {
        return this.getIdentity().role >= minRole;
      },
    }),
  },
});
```

프로덕션·다중 인스턴스는 Redis 등 외부 어댑터로 바꾸세요. [캐시](/ko/core/cache) 참고. Cookie 기본 이름은 `sessionId`. `setCookie` 기본은 `httpOnly: true`, `sameSite: Strict`(교차 사이트 프론트는 `'none'`과 `secure`).

| 옵션 | 언제 쓰는지 |
| --- | --- |
| `store` | 세션 저장 위치. 로컬 memory, 다중 복제본 Redis |
| `cookie.maxAge` | 세션 유효 초; **필수** |
| `cookie.name` / `path` / `domain` / `sameSite` / `secure` | 프론트 도메인·교차 사이트 여부에 맞춤 |
| `sliding` | 인증 성공할 때마다 TTL + Cookie 연장. 활성 사용자 강제 로그아웃 감소 |
| `generateCacheKey` | 키 접두사 커스텀. 기본 `auth:session:${sessionId}` |
| `onLoaded` | Stored → 업무 신원. DB 조회·폐기 |
| `onAuthorize` | `authorize(역할)`이 필요할 때만 |

## 로그인, 인증, 로그아웃

로그인 라우트에 `authenticate`를 **걸지 마세요**. `strategy.login(ctx, stored)`로 캐시 기록과 Cookie 설정(새 `sessionId` 발급. 요청에 옛 Cookie가 있으면 새 세션 성공 후 옛 세션 삭제). 보호 API는 `authenticate('session')`, 읽기는 `ctx.auth.session`.

```typescript
const session = auth.strategy('session');

export const publicRouter = new Router({ prefix: '/api' });

publicRouter.post('/login', { // [!code focus:12]
  mount: [body({ email: rule.email(), password: rule.string() })],
  action: async (ctx) => {
    const user = await verifyPassword(ctx.body);
    if (!user) {
      return ctx.throw(401, 'invalid credentials');
    }

    await session.login(ctx, { userId: user.id }); // [!code highlight]
    ctx.send({ ok: true });
  },
});

publicRouter.post('/logout', {
  action: async (ctx) => {
    await session.logout(ctx);
    ctx.send(204, null);
  },
});

export const privateRouter = new Router({
  prefix: '/api',
  mount: [auth.authenticate('session')],
});

privateRouter.get('/me', {
  action: async (ctx) => {
    ctx.send(ctx.auth.session.data); // [!code highlight]
  },
});
```

인증 성공 후:

```typescript
ctx.auth.session // { sessionId: string; data: Loaded }
```

`data`는 `onLoaded` 반환값입니다. `logout`은 캐시 삭제와 Cookie 제거. `touch`는 TTL만 연장. 권한 상승·민감 작업 후 id를 돌리려면 `regenerateSessionId(ctx)`(새 Stored를 넘겨도 됨).

::: warning
교차 출처에서는 프론트가 반드시 `credentials: 'include'`를 써야 합니다. 안 쓰면 브라우저가 `sessionId` Cookie를 안 보내 「로그인은 됐는데 바로 401」처럼 보입니다.
:::

## Bearer / JWT와 고르기

| | Session | Bearer / JWT |
| --- | --- | --- |
| 자격 증명 위치 | HttpOnly Cookie | 헤더 / 로컬 스토리지 |
| 교차 출처 | CORS credentials + 보통 CSRF | 대개 `Authorization`만 |
| 폐기 | 캐시 삭제면 됨 | Bearer는 세션 삭제; JWT는 짧은 TTL / 블랙리스트 |
| 전형적인 클라이언트 | 브라우저 SPA / 관리 콘솔 | App, 오픈 플랫폼, 서비스 간 |

동일 출처 관리 콘솔은 Session 우선. 공개 API는 Bearer 또는 JWT. 총 입구는 [인증](/ko/plugins/auth).

## 관련

- [CORS](/ko/plugins/cors)
- [CSRF](/ko/plugins/csrf)
- [인증](/ko/plugins/auth)
- [캐시](/ko/core/cache)
- [Bearer 전략](/ko/plugins/auth-bearer-strategy)
