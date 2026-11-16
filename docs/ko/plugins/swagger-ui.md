---
outline: deep
---

# Swagger UI

localhost나 내부망에 **클릭해서 시도하는** API 문서를 호스팅합니다. OpenAPI Document(내보낸 `openapi.json` 또는 런타임 `generateOpenapi`)가 필요합니다. 긴 글 읽기: [Redoc UI](/ko/plugins/redoc-ui); 둘 다 가능—**prefix는 구분**.

계약 소스: [OpenAPI 생성](/ko/plugins/openapi) · [OpenAPI 내보내기](/ko/console/openapi).

```bash
pnpm add @aomex/swagger-ui
```

`WebApp.mount`에 `swaggerUI`—개발자는 `/swagger`(또는 지정 prefix)에서 Browse·Try it out.

## 정적 파일 또는 동적 generateOpenapi

**CI 내보내기**(흔함):

```typescript
import { swaggerUI } from '@aomex/swagger-ui';

mount: [
  swaggerUI({ openapi: './openapi.json' }), // [!code highlight]
  routers('./src/routers'),
],
```

브라우저: `/swagger`(또는 `/swagger/index.html`); spec JSON은 보통 같은 prefix의 `openapi.json`.

**라이브 라우트와 동기**(정적 파일 없음):

```typescript
import { swaggerUI } from '@aomex/swagger-ui';
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

mount: [ // [!code focus:12]
  swaggerUI({
    uriPrefix: '/docs',
    openapi: () => { // [!code highlight]
      return generateOpenapi({
        routers: './src/routers',
        app,
      });
    },
  }),
  routers('./src/routers'),
],
```

`swaggerUI`는 일반 Web 미들웨어—비즈니스 라우트 추론은 안 바뀝니다. `openapi`는 **경로 문자열** 또는 **`Promise<Document>` 함수**; 함수면 **같은** `WebApp`(`app`)을 `generateOpenapi`에 넘기지 않으면 문서의 security/envelope가 프로덕션과 어긋납니다.

`enable` 함수는 내부 게이트용 요청 컨텍스트를 받고 boolean 반환이 타입 검사됩니다.

## uriPrefix와 프로덕션 enable

| 옵션 / 패턴 | 언제 쓰나 |
| --- | --- |
| `openapi: './openapi.json'` | CI `aomex openapi` 내보내기 후 |
| `openapi: () => generateOpenapi(...)` | 계약 파일 커밋 생략; 같은 `app` 전달 |
| `uriPrefix` | 기본 `/swagger` 충돌 방지 |
| `enable` | 공인터넷 끄기 또는 토큰/IP allowlist |

프로덕션 제한 예:

```typescript
swaggerUI({
  openapi: './openapi.json',
  enable: (ctx) => { // [!code highlight]
    const ipOk = ctx!.request.ip === '127.0.0.1';
    const tokenOk =
      ctx!.request.headers['x-docs-token'] === process.env.DOCS_TOKEN;
    return ipOk || tokenOk;
  },
});
```

`routers` 앞뒤 모두 보통 동작—**비즈니스 API prefix와 겹치지 마세요**(예: 비즈 `/docs` vs `uriPrefix: '/docs'`). `redocUI`와 prefix 분리.

::: warning
공개 Swagger는 API 지도+Try it out 노출—최소 `enable` 또는 네트워크 격리.
:::

동적 `openapi: () => generateOpenapi(...)`에서 live `app` 없으면 문서엔 auth 없고 호출은 401. 정적 모드: 코드만 바꾸고 파일 안 갱신하면 UI가 stale.

## 관련

- [Redoc UI](/ko/plugins/redoc-ui)
- [OpenAPI 생성](/ko/plugins/openapi)
- [OpenAPI 내보내기](/ko/console/openapi)