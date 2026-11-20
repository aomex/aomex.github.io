---
outline: deep
---

# Helmet 보안 헤더

브라우저 대면 HTTP API에 합리적인 기본 보안 헤더 묶음을 붙입니다(CSP, HSTS, `X-Frame-Options` 등). HTML/H5·관리 콘술에 특히 중요하고, 순수 JSON API도 다층 방어에 도움이 됩니다.

Helmet은 응답 헤더만 바꿉니다. 비즈니스 `ctx` 타입이나 라우트 추론은 그대로입니다.

```bash
pnpm add @aomex/helmet
```

## WebApp 기본 묶음

인자 없는 `helmet()`은 upstream 기본을 적용합니다. HTML·H5·관리 화면이 있을 때 `WebApp.mount`에 두는 경우가 많습니다.

```typescript
import { helmet } from '@aomex/helmet';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    helmet(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

[CORS](/ko/plugins/cors)와 함께 쓰면 둘 다 `routers` 앞에 둡니다. 헤더는 리버스 프록시에도 둘 수 있고, 앱 마운트는 환경별 토글이 쉽습니다.

일반 `WebMiddleware`—비즈니스 `ctx` 필드는 없습니다. DevTools → Network → 응답 헤더에서 `X-Content-Type-Options`, `X-Frame-Options` 등을 볼 수 있습니다(정확한 집합은 기본값·하위 옵션에 따름).

## CSP와 환경 분기

| 기능 | 언제 쓰나 |
| --- | --- |
| `contentSecurityPolicy` | 스크립트·스타일·이미지 출처 제한 |
| `strictTransportSecurity` | HTTPS 강제 |
| `frameguard` / `crossOriginOpenerPolicy` | iframe·팝업 격리 |
| 하위 옵션 비활성 | Swagger/Redoc·로컬 HMR | `contentSecurityPolicy: false` 등 |

```typescript
helmet({
  contentSecurityPolicy: { // [!code highlight]
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
    },
  },
});
```

### 개발 vs 프로덕션

```typescript
const security =
  process.env.NODE_ENV === 'production'
    ? helmet()
    : helmet({ contentSecurityPolicy: false }); // [!code highlight]

mount: [security, cors(), routers('./src/routers')];
```

| 환경 | 권장 |
| --- | --- |
| 프로덕션(관리/H5) | 켜기; CSP는 프론트 자산 목록과 맞춤 |
| 프로덕션(JSON만, HTML 없음) | 선택; 게이트웨이가 이미 헤더를 넣으면 생략 가능 |
| 로컬 | 문서/Swagger는 `contentSecurityPolicy: false` 가능 |

CSP를 CDN·스크립트 호스트 없이 붙이면 빈 화면·콘솔 CSP 오류가 납니다. 프로덕션에서 CSP를 끄면 인라인 스크립트 위험이 커집니다. Helmet은 [CORS](/ko/plugins/cors)를 **대체하지 않습니다**—교차 출처는 따로 맞추세요.

## 다음 단계

- 교차 출처: [CORS](/ko/plugins/cors)
- Cookie 로그인 위조 방지: [CSRF](/ko/plugins/csrf)
- 공개 API 문서 UI: [Swagger UI](/ko/openapi/swagger-ui), [Redoc UI](/ko/openapi/redoc-ui)
- 미들웨어 위치: [미들웨어](/ko/core/middleware)