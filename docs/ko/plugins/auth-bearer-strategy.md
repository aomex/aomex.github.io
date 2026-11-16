---
outline: deep
---

# Bearer 전략

전형적인 프론트 패턴: `Authorization: Bearer <token>`. 서버는 불투명 토큰을 사용자로 바꿉니다. 실패 → **401**. 로컬 검증·DB 조회 감소는 [JWT 전략](/ko/plugins/auth-jwt-strategy)—폐기·권한 변경은 별도 작업.

`AuthBearerStrategy`: 요청에서 토큰 추출, `onLoaded`에서 신원 해석; `onAuthorize`에서 역할 비교; 비즈니스에서는 `ctx.auth.bearer.data`, 원문 토큰 문자열 말고.

## 설치

Bearer는 `@aomex/auth` 본패키지—서브경로 import.

```bash
pnpm add @aomex/auth
```

```typescript
import { AuthBearerStrategy } from '@aomex/auth/bearer';
```

## onLoaded와 Router 마운트

```typescript
import { Auth } from '@aomex/auth';
import { AuthBearerStrategy } from '@aomex/auth/bearer';
import { Router } from '@aomex/web';

const auth = new Auth({
  strategies: {
    bearer: new AuthBearerStrategy({
      onLoaded: async (token, ctx) => {
        const row = await db.tokens.find(token);
        if (!row) {
          return false;
        }
        return { userId: row.userId, role: row.role };
      },
      onAuthorize(minRole: number) {
        return this.getIdentity().role >= minRole;
      },
    }),
  },
});

const router = new Router({ // [!code focus:10]
  mount: [auth.authenticate('bearer')], // [!code highlight]
});

router.get('/me', {
  action: async (ctx) => {
    ctx.send(ctx.auth.bearer.data);
  },
});

router.delete('/posts/:id', {
  mount: [auth.authenticate('bearer').authorize(10)],
  action: async (ctx) => {
    ctx.send(204, null);
  },
});
```

로그인에서 토큰 발급(authenticate 없음):

```typescript
router.post('/login', { // [!code focus:13]
  mount: [body({ email: rule.email(), password: rule.string() })],
  action: async (ctx) => {
    const user = await verifyPassword(ctx.body);
    if (!user) {
      return ctx.throw(401, 'invalid credentials');
    }

    const token = auth.strategy('bearer').signature('sha256', user.id); // [!code highlight]
    await saveSession(token, { userId: user.id, role: user.role });
    ctx.send({ token });
  },
});
```

`signature`는 **불투명** 랜덤 문자열(선택적 업무 키로 격리)—**JWT 아님**. 로그인 라우트에 authenticate 금지.

```typescript
ctx.auth.bearer // { token: string; data: T }
```

`T`는 `onLoaded` 반환 타입. `authorize('bearer', n)` 타입은 `onAuthorize`를 따릅니다. `onAuthorize`는 인스턴스 메서드일 수 있습니다.

```typescript
onAuthorize: (minRole: number) => {
  return (identity) => {
    return identity.role >= minRole;
  };
},
```

## tokenLoaders와 onLoaded

| 옵션 | 언제 쓰나 | 기본값 |
| --- | --- | --- |
| `onLoaded` | Redis/DB 조회; `false` → 401 | — |
| `onAuthorize` | 역할·권한 비교 | — |
| `tokenLoaders` | 커스텀 헤더/쿠키에서 토큰 | `Authorization: Bearer` |

```typescript
new AuthBearerStrategy({
  tokenLoaders: [ // [!code highlight]
    { type: 'header', key: 'authorization' },
    { type: 'query', key: 'access_token' },
  ],
  onLoaded: async (token) => {
    const session = await cache.getSession(token);
    return session || false;
  },
});
```

OpenAPI에는 auth.authenticate('bearer')가 있는 동일 `WebApp`을 `generateOpenapi({ app })`에 넘기세요. 개요: [인증](/ko/plugins/auth).

## 관련

- [JWT 전략](/ko/plugins/auth-jwt-strategy)
- [API Key 전략](/ko/plugins/auth-api-key-strategy)