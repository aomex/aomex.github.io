---
outline: deep
---

# Redoc UI

제품·연동처에 **길게 읽기 좋은** API 설명을 제공합니다: 왼쪽 탐색, schema 접기로 Swagger보다 깔끔합니다. Redoc은 **페이지 안에서 바로 시도할 수 없습니다** — 연동은 [Swagger UI](/ko/openapi/swagger-ui), [Scalar UI](/ko/openapi/scalar-ui), 또는 자체 클라이언트를 쓰세요. 여러 UI를 같은 사이트에 둘 수 있으며 **라우트 prefix가 겹치면 안 됩니다**.

계약 출처: [OpenAPI 생성](/ko/openapi/).

```bash
pnpm add @aomex/redoc-ui
```

mount에 `redocUI`를 걸면 팀은 `/redoc`(기본)에서 같은 OpenAPI(JSON 또는 YAML 경로)를 읽을 수 있습니다.

## Swagger와 prefix 분리 병행

```typescript
import { redocUI } from '@aomex/redoc-ui';
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

mount: [ // [!code focus:13]
  redocUI({
    openapi: './openapi.yaml', // [!code highlight]
    // 或与 Swagger 一样用函数：
    // openapi: () => {
    //   return generateOpenapi({
    //     routers: './src/routers',
    //     app,
    //   });
    // },
  }),
  routers('./src/routers'),
],
```

Swagger와 함께 둘 때:

```typescript
mount: [
  swaggerUI({ openapi: './openapi.json', uriPrefix: '/swagger' }),
  redocUI({ openapi: './openapi.json', uriPrefix: '/redoc' }), // [!code highlight]
  routers('./src/routers'),
],
```

::: warning
Redoc은 **페이지 내 시도를 지원하지 않습니다**. QA가 Swagger 대신으로 쓰지 마세요. 다른 문서 UI와 병행할 때 `uriPrefix`를 나누고 **무작위 문자열**(예: `/redoc-7c3e9a1f02b48d6e`)을 붙여 스캔 후 남용 위험을 줄이세요 — [Swagger UI](/ko/openapi/swagger-ui) 참고.
:::

Swagger UI와 같이 `redocUI`는 Web 미들웨어 설정이며 비즈니스 라우트의 `ctx` 타입은 바꾸지 않습니다. `openapi`는 문자열 경로 또는 Document를 비동기 반환하는 함수입니다. 함수 형태에서 `generateOpenapi` 옵션 타입은 [OpenAPI 생성](/ko/openapi/) 페이지와 같습니다.

접근 제어, `uriPrefix`(무작위 suffix 포함), `enable` 등은 Swagger / Scalar와 **같은 개념**이며, 정확한 필드는 설치한 패키지 타입 힌트를 따르세요.

```typescript
redocUI({
  openapi: './openapi.json',
  uriPrefix: '/redoc-7c3e9a1f02b48d6e',
});
```

Swagger / Scalar와의 대조, 병행, 시나리오 선택은 [문서 UI 고르기](/ko/openapi/choose-ui)를 보세요. 정적 `openapi.yaml` 경로가 잘못되었거나 빌드에 파일이 복사되지 않으면 온라인에서 404가 납니다. 계약을 파일로 쓸 때는 라우트 변경 후 [OpenAPI 생성](/ko/openapi/)을 다시 실행하세요.

## 관련

- [문서 UI 고르기](/ko/openapi/choose-ui)
- [Swagger UI](/ko/openapi/swagger-ui) · [Scalar UI](/ko/openapi/scalar-ui)
- [OpenAPI 생성](/ko/openapi/)