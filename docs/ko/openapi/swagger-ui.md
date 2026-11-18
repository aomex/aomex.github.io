---
outline: deep
---

# Swagger UI

로컬 또는 내부망에 **열자마자 시도할 수 있는** API 문서를 걸 수 있습니다. 전제는 OpenAPI Document(내보낸 `openapi.json` 또는 런타임 `generateOpenapi`)입니다. 긴 글 읽기는 [Redoc UI](/ko/openapi/redoc-ui); 현대적인 시도 UI는 [Scalar UI](/ko/openapi/scalar-ui)를 보세요. 여러 UI를 같이 둘 수 있으며 **prefix가 겹치면 안 됩니다**.

계약 출처: [OpenAPI 생성](/ko/openapi/).

```bash
pnpm add @aomex/swagger-ui
```

`WebApp.mount`에 `swaggerUI`를 걸면, 개발자는 `/swagger`(또는 지정한 prefix)에서 Browse하고 Try it out 할 수 있습니다.

## 내보낸 파일 또는 동적 generateOpenapi

**CI로 이미 내보냄**(흔함):

```typescript
import { swaggerUI } from '@aomex/swagger-ui';

mount: [
  swaggerUI({ openapi: './openapi.json' }), // [!code highlight]
  routers('./src/routers'),
],
```

브라우저: `/swagger`(또는 `/swagger/index.html`); spec JSON은 보통 같은 prefix 아래 `openapi.json`입니다.

**운영 라우트와 동기**(정적 파일 없이 유지):

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

`swaggerUI`는 mount 안의 일반 Web 미들웨어이며, 비즈니스 라우트에 대한 컴파일러 추론은 바꾸지 않습니다. `openapi`에는 **경로 문자열** 또는 **`Promise<Document>`를 반환하는 함수**를 넘길 수 있습니다. 함수일 때는 **같은** `WebApp`(`app`)을 `generateOpenapi`에 넘기지 않으면 문서의 security / envelope가 실환경과 달라집니다.

`enable`을 함수로 쓰면 요청 컨텍스트로 내부망 문턱을 걸 수 있으며, boolean 반환은 타입 검사로 막을 수 있습니다.

## uriPrefix와 프로덕션 enable

| 옵션 / 패턴 | 언제 쓰나 |
| --- | --- |
| `openapi: './openapi.json'` | CI `aomex openapi` 내보낸 뒤 호스팅 |
| `openapi: () => generateOpenapi(...)` | 계약 파일을 커밋하지 않을 때; 같은 `app` 전달 |
| `uriPrefix` | 기본 `/swagger` 변경; **무작위 문자열**을 붙여 스캔 후 남용 위험 완화 |
| `enable` | 프로덕션 공인터넷에서 문서 끄기 또는 token / IP 화이트리스트 |

기본 `/swagger`, `/redoc`, `/scalar`는 너무 쉽게 추측됩니다. 스캐폴드는 `/swagger-7c3e9a1f02b48d6e` 같은 prefix를 씁니다 — 외부가 흔한 경로를 스캔해도 문서 페이지를 못 얻을 수 있습니다. 무작위 문자열은 **인증이 아니라** 노출 비용만 올립니다. 공인터넷에서는 `enable`, 내부망, 게이트웨이와 함께 쓰세요.

```typescript
swaggerUI({
  openapi: './openapi.json',
  uriPrefix: '/swagger-7c3e9a1f02b48d6e',
});
```

프로덕션에 접근 문턱 추가:

```typescript
swaggerUI({
  openapi: './openapi.json',
  uriPrefix: '/swagger-7c3e9a1f02b48d6e',
  enable: (ctx) => { // [!code highlight]
    const ipOk = ctx!.request.ip === '127.0.0.1';
    const tokenOk =
      ctx!.request.headers['x-docs-token'] === process.env.DOCS_TOKEN;
    return ipOk || tokenOk;
  },
});
```

걸 위치: 보통 `routers` 앞뒤 모두 동작하지만 **비즈니스 API prefix와 충돌하지 마세요**. `redocUI` / `scalarUI`와 함께 켤 때는 각 `uriPrefix`를 나누고(모두 무작위 suffix 권장).

::: warning
공인터넷에 Swagger를 그대로 열면 API 지도와 Try it out을 함께 넘기는 셈입니다. 무작위 prefix와 `enable` / 네트워크 격리를 함께 쓰세요.
:::

동적 `openapi: () => generateOpenapi(...)`에서 운영과 같은 `app`을 안 넘기면 페이지에는 「인증 불필요」로 보이고 래핑 모양도 빠지는데, 실제 호출은 401이 날 수 있습니다. 정적 `openapi.json` 모드에서 코드만 바꾸고 파일을 갱신하지 않으면 UI는 예전 계약을 보여줍니다.

Redoc / Scalar와의 대조, 병행, 시나리오 선택은 [문서 UI 고르기](/ko/openapi/choose-ui)를 보세요.

## 관련

- [문서 UI 고르기](/ko/openapi/choose-ui)
- [Scalar UI](/ko/openapi/scalar-ui) · [Redoc UI](/ko/openapi/redoc-ui)
- [OpenAPI 생성](/ko/openapi/)