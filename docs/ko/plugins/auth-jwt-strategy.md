---
outline: deep
---

# JWT 전략

자체 포함 토큰: 게이트웨이·서비스에서 로컬 검증, Redis/DB 조회 감소. 폐기·권한 변경은 블랙리스트·짧은 만료·추가 검증 등 별도 설계가 필요합니다.

`AuthJwtStrategy`에 secret(또는 키 쌍), `onVerified`로 payload→신원. 비즈니스에서는 `ctx.auth.jwt.data`, 원문 JWT 문자열 말고.

```bash
pnpm add @aomex/auth
pnpm add @aomex/auth-jwt-strategy
```

## secret과 onVerified

```typescript
import { Auth } from '@aomex/auth';
import { AuthJwtStrategy } from '@aomex/auth-jwt-strategy';
import { Router } from '@aomex/web';

const auth = new Auth({
  strategies: {
    jwt: new AuthJwtStrategy({
      secret: process.env.JWT_SECRET!,
      onVerified: (payload) => { // [!code highlight]
        return {
          userId: String(payload.sub),
          roles: (payload.roles as string[]) ?? [],
        };
      },
      onAuthorize(level: number) {
        const identity = this.getIdentity();
        return identity.roles.includes('admin') || level <= 1;
      },
    }),
  },
});

export const router = new Router({
  mount: [auth.authenticate('jwt')],
});

router.get('/me', {
  mount: [auth.authorize('jwt', 1)],
  action: async (ctx) => {
    ctx.send({ userId: ctx.auth.jwt.userId });
  },
});
```

login·refresh action에서 서명:

```typescript
const token = auth.strategy('jwt').signature(
  { sub: user.id, roles: user.roles },
  { expiresIn: '7d' },
);
```

## ctx.auth 형태 vs Bearer

| 전략 | 대략 `ctx.auth[name]` 형태 |
| --- | --- |
| Bearer | `{ token, data }` |
| JWT | `{ data }`(payload 중심) |

검증 실패는 **401**. `onVerified`가 `false`면 동일.

```typescript
new AuthJwtStrategy({
  secret: process.env.JWT_SECRET!,
  verifyOptions: { algorithms: ['HS256'], audience: 'api' }, // [!code highlight]
  onVerified: (payload) => {
    if (isRevoked(payload.jti)) {
      return false;
    }
    return {
      userId: String(payload.sub),
      roles: (payload.roles as string[]) ?? [],
    };
  },
});
```

비대칭 키·로테이션: [고급: 커스텀 auth 전략](/ko/advanced/auth-strategy).

검증 실패 시 clock skew·`aud`/`iss` 불일치를 확인하세요. OpenAPI에는 `generateOpenapi`에 동일 `app`으로 bearer/jwt security를 맞춥니다.

## 관련

- [인증 개요](/ko/plugins/auth)
- [Bearer 전략](/ko/plugins/auth-bearer-strategy)