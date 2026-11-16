---
outline: deep
---

# Redoc UI

제품·파트너 팀용 **길게 읽기 좋은** API 레퍼런스: 왼쪽 탐색, 접힌 schema로 Swagger보다 차분합니다. Redoc은 **브라우저에서 API를 호출하지 않습니다**. 호출은 [Swagger UI](/ko/plugins/swagger-ui)나 자체 클라이언트를 쓰세요. 두 UI를 같이 둘 수 있으며 **uriPrefix**는 구분하세요.

계약 소스: [OpenAPI 생성](/ko/plugins/openapi) · [OpenAPI 내보내기](/ko/console/openapi).

```bash
pnpm add @aomex/redoc-ui
```

`mount`에 `redocUI`를 걸면 팀이 `/redoc`(기본)에서 같은 OpenAPI(JSON 또는 YAML 경로)를 읽습니다.

## Swagger와 prefix 분리

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

Swagger와 나란히:

```typescript
mount: [
  swaggerUI({ openapi: './openapi.json', uriPrefix: '/swagger' }),
  redocUI({ openapi: './openapi.json', uriPrefix: '/redoc' }), // [!code highlight]
  routers('./src/routers'),
],
```

::: warning
Redoc은 **브라우저에서 API를 실행하지 않습니다**. QA에서 Swagger 대용으로 쓰지 마세요. 둘 다 마운트할 때 `uriPrefix`를 나누세요(예: `/redoc` vs `/swagger`).
:::

Swagger UI와 같이 `redocUI`는 Web 미들웨어 설정이며 비즈니스 라우트 `ctx` 타입은 바꾸지 않습니다. `openapi`는 파일 경로 또는 `Document`를 반환하는 async 함수입니다. 함수 형태는 [OpenAPI 생성](/ko/plugins/openapi) 옵션과 맞춥니다.

접근 제어, `uriPrefix`, `enable` 등은 **Swagger와 같은 개념**이며, 정확한 필드는 설치한 패키지 타입 힌트를 따르세요.

## Redoc vs Swagger

| 상황 | 권장 |
| --- | --- |
| 외부 PDF / 인수 문서 | Redoc이 읽기 좋음; 내보낸 계약 + 안정 URL |
| 개발자 자가 검증·호출 | Swagger UI 또는 Postman 추가 |
| 계약이 자주 바뀜 | `openapi: () => generateOpenapi(...)` 또는 CI 내보내기 후 한 파일 공유 |
| 프로덕션 노출 | Swagger와 같이 `enable`, 내부망, 게이트웨이 auth |

잘못된 `openapi.yaml` 경로나 빌드에 파일 미복사 → 온라인 404. 파일 계약은 라우트 변경 후 [OpenAPI 내보내기](/ko/console/openapi)를 다시 실행하세요.

## 관련

- [Swagger UI](/ko/plugins/swagger-ui)
- [OpenAPI 생성](/ko/plugins/openapi)
- [OpenAPI 내보내기](/ko/console/openapi)