---
outline: deep
---

# 인증

두 가지: **당신이 누구인지**(인증)와 **무엇을 할 수 있는지**(권한). `@aomex/auth`는 여러 전략을 하나의 `Auth` 인스턴스에 모읍니다. 신원 실패는 보통 **401**, 권한 부족은 **403**. 프론트와 모니터링은 「다시 로그인」과 「잘못된 계정 / 더 높은 역할 필요」를 구분할 수 있습니다.

라우트 그룹에 「로그인 필수」를 걸고 일부는 역할로 강화합니다. 로그인 라우트는 열어 두고, 로그인 후 `ctx.auth`에서 신원을 읽습니다.

## 설치

쓰는 전략용 패키지를 설치하세요. 로그인 전에는 이 페이지를 로드맵으로 보세요.

```bash
pnpm add @aomex/auth
# JWT 另装：pnpm add @aomex/auth-jwt-strategy
```

| 전략 패키지 | 일반적인 용도 |
| --- | --- | --- |
| [`@aomex/auth/bearer`](/ko/plugins/auth-bearer-strategy) | 불투명 토큰, 서버 측 세션 |
| [`@aomex/auth/api-key`](/ko/plugins/auth-api-key-strategy) | 기계 간 호출, 오픈 플랫폼 |
| [`@aomex/auth-jwt-strategy`](/ko/plugins/auth-jwt-strategy) | 자체 포함 JWT, DB 조회 감소 |

## Router에 authenticate 마운트

`Auth`에 전략(Bearer / API Key / JWT)을 등록하고 `authenticate(name)`는 `Router` 또는 단일 라우트용 신원 미들웨어를 반환합니다. 성공 후 `ctx.auth[name]`을 읽고, 라우트별 `authorize`로 세분 권한을 겁니다.

```typescript
import { Auth } from '@aomex/auth';
import { AuthBearerStrategy } from '@aomex/auth/bearer';
import { Router } from '@aomex/web';

const auth = new Auth({
  strategies: {
    bearer: new AuthBearerStrategy({
      onLoaded: async (token) => {
        const user = await findUserByToken(token);
        return user ?? false; // false → 401
      },
      onAuthorize(minRole: number) {
        return this.getIdentity().role >= minRole;
      },
    }),
  },
});

export const router = new Router({ // [!code focus:10]
  prefix: '/api',
  mount: [auth.authenticate('bearer')], // [!code highlight]
});

router.get('/profile', {
  action: async (ctx) => {
    ctx.send(ctx.auth.bearer.data);
  },
});

router.delete('/posts/:id', {
  mount: [auth.authorize('bearer', 10)],
  action: async (ctx) => {
    ctx.send(204, null);
  },
});
```

한 라우트에 체인:

```typescript
router.post('/admin/reboot', {
  mount: [auth.authenticate('bearer').authorize(99)], // [!code highlight]
  action: async (ctx) => {
    // …
  },
});
```

- `authenticate('bearer')` 통과 후 `ctx.auth.bearer`가 의미 있습니다. 타입에 전략 이름이 포함됩니다.
- `authorize('bearer', 10)` 두 번째 인자는 `onAuthorize` 서명(숫자, 권한 코드 등)을 따릅니다.
- `auth.strategy('bearer').signature(...)`는 토큰 **발급용 login action**에 두지, auth 미들웨어에 두지 마세요.

```typescript
// 登录成功后签发（示例）
const token = auth.strategy('bearer').signature('sha256', user.id);
```

## authenticate(name)

| 때 | 위치 |
| --- | --- |
| 그룹 전체 로그인 필수 | `Router.mount` |
| 한 파일에 공개·비공개 혼재 | 라우트 `mount` 또는 Router 분리 |

흐름: 전략 실패 → **401**; 성공 시 `ctx.auth[name]` 기록. 반환 미들웨어에 `.authorize(...)` 체인이 있습니다. 토큰 없음/무효 → **401**; 로그인했지만 불가 → **403**—의미를 섞지 마세요.

### authorize(name, ...args)

해당 전략으로 **이미** 인증됐다고 가정합니다. `authenticate` 없이 `authorize`만으로는 런타임에서 막을 수 없습니다. 마운트 순서를 확인하세요. 실패는 보통 **403**.

### strategy(name)

login/refresh에서 자격 증명 발급(Bearer 랜덤, JWT payload 등). **login 라우트에 authenticate를 걸지 마세요.** 토큰 없는 클라이언트는 들어오지 못합니다.

### 어디에 마운트할지

| 위치 | 적합 | 비고 |
| --- | --- | --- |
| `Router.mount` | 비공개 API 그룹 전체 | 같은 파일에 공개 라우트 섞지 않기 |
| 라우트 `mount` | 공개 일부 / 더 강한 auth | 반복 시 상수로 추출 |
| `WebApp.mount` | 사이트 거의 전체 비공개 | 헬스체크는 별도 Router |

공개 API는 `skip` 대신 `authenticate` 없는 별도 Router를 선호하세요.

OpenAPI `generateOpenapi`에는 프로덕션과 같은 `app`을 넘기면 `security`가 실제 auth와 맞습니다. 여러 전략이면 `authenticate('jwt')` 이름이 `strategies` 키와 같아야 합니다.

## 관련

- [Bearer 전략](/ko/plugins/auth-bearer-strategy)
- [API Key 전략](/ko/plugins/auth-api-key-strategy)
- [JWT 전략](/ko/plugins/auth-jwt-strategy)
- 특수 프로토콜: [고급: 커스텀 auth 전략](/ko/advanced/auth-strategy)