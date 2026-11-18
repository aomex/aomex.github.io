---
outline: deep
---

# Scalar UI

[Scalar](https://github.com/scalar/scalar) 기반 API 문서 페이지를 걸 수 있습니다. 읽기 경험은 현대적이고 페이지 내 시도도 됩니다. 계약은 다른 UI와 같이 내보낸 `openapi.json` / yaml 또는 런타임 `generateOpenapi`에서 옵니다. [Swagger UI](/ko/openapi/swagger-ui) / [Redoc UI](/ko/openapi/redoc-ui)와 같은 사이트에 둘 수 있으며 **uriPrefix가 겹치면 안 됩니다**(기본 `/scalar`).

계약 출처: [OpenAPI 생성](/ko/openapi/).

```bash
pnpm add @aomex/scalar-ui
```

`WebApp.mount`에 `scalarUI`를 걸고 `/scalar`(또는 지정 prefix)를 열면 Browse할 수 있습니다.

## 내보낸 파일 또는 동적 generateOpenapi

**CI로 이미 내보냄**(흔함):

```typescript
import { scalarUI } from '@aomex/scalar-ui';

mount: [
  scalarUI({ openapi: './openapi.json' }), // [!code highlight]
  routers('./src/routers'),
],
```

yaml / yml 경로도 됩니다. 브라우저: `/scalar`; 같은 prefix 아래에 보통 `openapi.json`이 있어 페이지가 가져옵니다.

**운영 라우트와 동기**:

```typescript
import { scalarUI } from '@aomex/scalar-ui';
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

mount: [ // [!code focus:12]
  scalarUI({
    uriPrefix: '/api-docs',
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

`scalarUI`는 일반 Web 미들웨어입니다. `openapi`에는 경로 문자열 또는 Document(비동기 가능)를 반환하는 함수를 넘깁니다. 함수일 때 **같은** `WebApp`(`app`)을 `generateOpenapi`에 넘기지 않으면 security / envelope가 실환경과 어긋납니다. 사이트 전역 [envelope](/ko/web/envelope)를 켠 경우 문서 페이지는 자동으로 `skipEnvelope`되어 래핑되지 않습니다.

## uriPrefix, enable, headTags

| 옵션 / 패턴 | 언제 쓰나 |
| --- | --- |
| `openapi: './openapi.json'` / `.yaml` | CI `aomex openapi` 내보낸 뒤 호스팅 |
| `openapi: () => generateOpenapi(...)` | 계약 파일 커밋 생략; 같은 `app` 유지 |
| `uriPrefix` | 기본 `/scalar`; **무작위 문자열** 경로로 스캔 후 남용 위험 완화 |
| `enable` | 프로덕션 공인터넷에서 문서 끄기 또는 token / IP 화이트리스트 |
| `headTags` | 문서 페이지 `<head>`에 favicon, 추가 meta / link 삽입 |

`/scalar`, `/swagger` 같은 기본 경로는 스캔되기 쉽습니다. prefix에 무작위 구간(예: `/scalar-7c3e9a1f02b48d6e`)을 넣는 것은 노출 비용만 올릴 뿐 **`enable` / 내부망 격리를 대체하지 않습니다** — [Swagger UI](/ko/openapi/swagger-ui)와 같은 생각입니다.

```typescript
scalarUI({
  openapi: './openapi.json',
  uriPrefix: '/scalar-7c3e9a1f02b48d6e', // [!code highlight]
  enable: (ctx) => { // [!code highlight]
    const ipOk = ctx!.request.ip === '127.0.0.1';
    const tokenOk =
      ctx!.request.headers['x-docs-token'] === process.env.DOCS_TOKEN;
    return ipOk || tokenOk;
  },
});
```

사이트 아이콘 삽입:

```typescript
scalarUI({
  openapi: './openapi.json',
  headTags: [
    {
      tag: 'link',
      props: {
        rel: 'shortcut icon',
        type: 'image/x-icon',
        href: '/favicon.ico',
      },
    },
  ],
});
```

걸 위치: 비즈니스 API prefix와 충돌하지 마세요. `swaggerUI` / `redocUI`와 함께 켤 때 세 `uriPrefix`를 모두 나누세요(무작위 suffix 권장).

::: warning
공인터넷에 문서 UI를 그대로 열면 API 지도(및 시도 기능)를 함께 넘기는 셈입니다. 무작위 prefix와 `enable` / 네트워크 격리를 함께 쓰세요.
:::

동적 `openapi`에서 운영과 같은 `app`을 안 넘기면 페이지의 인증 / 래핑 모양이 실제 연동과 맞지 않습니다. 정적 파일 모드에서는 라우트 변경 후 [OpenAPI 생성](/ko/openapi/)으로 다시 내보내세요.

Swagger / Redoc과의 대조, 병행, 시나리오 선택은 [문서 UI 고르기](/ko/openapi/choose-ui)를 보세요.

## 관련

- [문서 UI 고르기](/ko/openapi/choose-ui)
- [Swagger UI](/ko/openapi/swagger-ui) · [Redoc UI](/ko/openapi/redoc-ui)
- [OpenAPI 생성](/ko/openapi/)