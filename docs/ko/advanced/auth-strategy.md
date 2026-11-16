---
outline: deep
---

# 사용자 정의 인증 전략

[Bearer](/ko/plugins/auth-bearer-strategy), [API Key](/ko/plugins/auth-api-key-strategy), [JWT](/ko/plugins/auth-jwt-strategy)가 대부분의 헤더 토큰·키 API를 다룹니다. 자격 증명 형태가 플러그인에 맞지 않을 때 다음을 원하면 직접 만듭니다.

- `auth.authenticate` / `authorize` 한 경로  
- 미인증 **401**, 권한 없음 **403**  
- 핸들러에서 `ctx.auth.<전략이름>.data`  
- OpenAPI security 일치  

쿠키 세션, 게이트웨이 헤더, mTLS 신원 등이 흔합니다. `ctx`에 `user`만 필요하고 Auth 규약이 중요하지 않다면 일반 미들웨어도 되지만, 보안·미인증 분기는 직접 챙깁니다.

아래는 **쿠키 세션**을 라우트에 거는 과정입니다.

## 1단계: 신원 형태 정하기

로그인 후 페이로드를 고정합니다. 예: `{ userId: number }`. 전략 첫 제네릭이자 `ctx.auth.session.data` 타입입니다.

두 번째 제네릭은 `authorize` 인자입니다. 예: 역할 이름 `[string]` → 이후 `.authorize('admin')`.

## 2단계: `authenticate` 구현(자격 수집)

요청에서 자격을 읽습니다. 없거나 잘못되면 아래 계약을 따르고 **잡히지 않은 throw는 피하세요**(클라이언트가 500으로 서비스 장애로 오해할 수 있음).

```typescript
// src/auth/session.strategy.ts
import { Strategy, AuthError } from '@aomex/auth';
import type { WebContext } from '@aomex/web';

export class SessionStrategy extends Strategy<{ userId: number }, [string]> {
  protected async authenticate(ctx: WebContext) {
    const sid = ctx.request.cookies?.['sid']; // [!code highlight]
    if (!sid) {
      return false; // → 401 未登录
    }
    const user = await findBySession(sid);
    if (!user) {
      return new AuthError('session expired'); // → 401，带消息
    }
    return { userId: user.id }; // → 写入 ctx.auth
  }

  protected async authorize(role: string) {
    const identity = this.getIdentity();
    return userHasRole(identity.userId, role);
  }
}
```

`authenticate` 반환값:

| 반환 | 동작 |
| --- | --- |
| 신원 객체 | `ctx.auth`에 저장, 파이프라인 계속 |
| `false` | 미로그인 → **401** |
| `AuthError` | 메시지와 함께 인증 실패 → **401** |

`authorize`가 falsy 또는 `AuthError` → **403**. `authorize` 안에서 `this.getIdentity()`는 성공한 `authenticate`의 객체입니다.

## 3단계: Auth에 연결 — 키가 전략 이름

```typescript
// src/auth/index.ts
import { Auth } from '@aomex/auth';
import { SessionStrategy } from './session.strategy.js';

export const auth = new Auth({
  strategies: {
    session: new SessionStrategy(), // [!code highlight]
  },
});
```

키 `session`이 세 가지를 결정합니다.

1. `auth.authenticate('session')`  
2. `ctx.auth.session`  
3. `ctx.auth.session.data` 형태(전략 제네릭)  

## 4단계: 마운트하고 라우트에서 검증

**공개 로그인**과 **보호** 라우트를 Router로 나눕니다(또는 인증 체인에 `.skip` — [미들웨어](/ko/core/middleware)). 한 그룹에 몰아넣고 auth가 알아서 건너뛸 거라 기대하지 마세요.

```typescript
import { Router } from '@aomex/web';
import { auth } from '../auth/index.js';

export const router = new Router({
  prefix: '/admin',
  mount: [auth.authenticate('session')], // 本组都要登录
});

router.get('/dashboard', {
  mount: [auth.authenticate('session').authorize('admin')], // [!code highlight]
  action: async (ctx) => {
    const userId = ctx.auth.session.data.userId;
    ctx.send({ userId });
  },
});
```

라우터 전체가 아니라 한 라우트 `mount`에만 `authenticate`를 걸 수도 있습니다. `.authorize('admin')` 체인은 `data` 타입을 바꾸지 않습니다. 실패 시 프레임워크가 403을 반환하므로 action에서 역할을 다시 검사할 필요는 보통 없습니다(세밀한 비즈니스 규칙은 별도).

수동 확인:

1. 쿠키 없음 → **401**  
2. 쿠키 있으나 역할 부족 → **403**  
3. 성공 → action에서 `userId` 사용  

## 5단계: OpenAPI security

사용자 정의 전략은 기본 `openapi()`로 401 응답을 얻습니다. security scheme 없으면 Swagger 「Authorize」가 쿠키·커스텀 헤더와 맞지 않고 Bearer로 생성된 클라이언트는 **401**을 반복합니다.

전략에서 `openapi()`를 재정의하세요(필드는 타입 힌트·Bearer 플러그인 참고):

```typescript
import type { OpenApiInjector } from '@aomex/web';

protected override openapi(): OpenApiInjector {
  return {
    ...super.openapi(),
    onDocument(document) {
      document.components ||= {};
      document.components.securitySchemes ||= {};
      document.components.securitySchemes['sessionCookie'] ||= {
        type: 'apiKey',
        in: 'cookie',
        name: 'sid',
      };
    },
    onMethod(methodItem) {
      methodItem.security ||= [];
      methodItem.security.push({ sessionCookie: [] });
    },
  };
}
```

OpenAPI를 다시 생성해 해당 operation에 security와 401 설명이 있는지 확인하세요.

::: warning
쿠키 이름, 헤더 이름, security 메타데이터는 자격을 읽는 방식과 같아야 합니다. 그렇지 않으면 **401** 루프가 납니다.
:::

## 커스텀 대신 쓰지 않을 때

| 상황 | 방법 |
| --- | --- |
| 표준 Bearer / JWT / API Key | 플러그인 전략 |
| 쿠키, 게이트웨이 헤더, 커스텀 서명 | 사용자 `Strategy`(이 페이지) |
| 헬스 체크, 정적 페이지 | 별도 라우터 또는 `.skip` — [미들웨어](/ko/core/middleware) |

## JWT 비대칭 키·로테이션(플러그인 유지)

커스텀 전략은 **자격 수집 방식**을 바꿉니다. JWT 알고리즘·로테이션은 [JWT 전략](/ko/plugins/auth-jwt-strategy)에 둡니다.

```typescript
import { AuthJwtStrategy } from '@aomex/auth-jwt-strategy';
import fs from 'node:fs';

new AuthJwtStrategy({
  publicKey: fs.readFileSync('public.pem'),
  privateKey: fs.readFileSync('private.pem'),
  verifyOptions: { algorithms: ['RS256'] }, // [!code highlight]
  legacySecretOrPublicKey: [oldSecret],
  onVerified: (payload) => {
    return payload;
  },
});
```

## 관련

- 진입점과 내장 전략: [Auth](/ko/plugins/auth)
- 401 / 403 JSON: [오류 형식](/ko/web/errors)
