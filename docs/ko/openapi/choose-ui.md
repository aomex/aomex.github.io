---
outline: deep
---

# 문서 UI 고르기

aomex는 문서 페이지 플러그인을 세 가지 제공합니다: [Swagger UI](/ko/openapi/swagger-ui), [Redoc UI](/ko/openapi/redoc-ui), [Scalar UI](/ko/openapi/scalar-ui). 모두 **같은** OpenAPI 계약(내보낸 `openapi.json` / yaml, 또는 런타임 `generateOpenapi`)을 읽으며, 차이는 **읽기 경험**과 **페이지에서 바로 호출할 수 있는지**입니다.

이 페이지는 독자와 시나리오에 맞게 고릅니다. 패키지 설치, mount, `uriPrefix` / `enable` 같은 세부는 각 UI 전용 페이지를 보세요. 계약 생성은 [OpenAPI 생성](/ko/openapi/)을 참고하세요.

## 한눈에 비교

| | [Swagger UI](/ko/openapi/swagger-ui) | [Redoc UI](/ko/openapi/redoc-ui) | [Scalar UI](/ko/openapi/scalar-ui) |
| --- | --- | --- | --- |
| 기본 prefix | `/swagger` | `/redoc` | `/scalar` |
| 페이지 내 시도 | 있음 (Try it out) | **없음** | 있음 |
| 읽기 경험 | 콘솔에 가깝고 필드가 촘촘 | 왼쪽 탐색, 장문에 유리 | 현대적 레이아웃, 읽기+호출 균형 |
| 전형적 독자 | 개발, QA 연동 | 제품, 연동처, 인수 문서 | 읽으면서 바로 API 호출 |
| 패키지 | `@aomex/swagger-ui` | `@aomex/redoc-ui` | `@aomex/scalar-ui` |

세 가지 모두 일반 Web 미들웨어입니다. mount하면 페이지가 열리며, 비즈니스 라우트의 `ctx` 타입은 **바꾸지 않습니다**. 사이트 전역 [envelope](/ko/web/envelope)를 켠 경우 문서 페이지는 자동으로 `skipEnvelope`되어 래핑되지 않습니다.

## 시나리오별 선택

| 지금 하는 일 | 우선 선택 | 이유 |
| --- | --- | --- |
| 로컬/내부망에서 열고 바로 호출 | Swagger 또는 Scalar | 브라우저에서 실제 요청; Try it out에 익숙하면 Swagger, 더 새로운 UI면 Scalar |
| 연동처용 「설명서」 URL | Redoc | 장문·schema 접기가 정돈됨; 페이지에서 시도는 기대하지 마세요 |
| 대외 PDF / 주간 보고용 API 설명 | Redoc | 인쇄·스크롤 읽기에 유리 |
| 온보딩: 먼저 읽고 시도 | Scalar, 또는 Redoc + Swagger 병행 | 한 페이지에서 읽고 시도; 또는 「읽기」와 「호출」 링크 분리 |
| 레거시 팀이 Swagger만 사용 | Swagger 유지 | 전환 비용 최소; UI만 바꿀 필요 없음 |
| 독자가 섞임(제품+개발) | **병행**, `uriPrefix` 분리 | 같은 계약으로 여러 UI — 아래 참고 |

망설이면: 개발 기간에는 **Scalar** 또는 **Swagger** 하나만 걸어도 일합니다. 대외 설명이 필요하면 **Redoc**을 추가하세요. 「셋 중 하나만」은 아닙니다 — 계약 소스는 하나입니다.

## 역할 경계(혼동 주의)

**페이지 내 시도**는 브라우저에서 파라미터를 채우고, 인증을 붙여, 실제(또는 게이트웨어 뒤) 서비스를 호출하는 것입니다. Swagger와 Scalar는 지원하고, Redoc은 **지원하지 않습니다**.

```typescript
// Redoc 只负责展示契约——联调请另开 Swagger / Scalar / Postman
mount: [
  redocUI({ openapi: './openapi.json', uriPrefix: '/redoc-…' }),
  swaggerUI({ openapi: './openapi.json', uriPrefix: '/swagger-…' }),
  routers('./src/routers'),
],
```

::: warning
QA나 연동처에 Redoc 링크를 「Try it out 있는 Swagger」처럼 보내지 마세요. 링크가 잘못되면 읽기만 되고 호출은 안 되어 API가 고장 난 것처럼 보일 수 있습니다.
:::

기타 경계:

- 문서 UI는 **인증 수단이 아닙니다**. 공개 노출은 API 지도를 넘기는 것이고(시도 가능하면 시도 진입점까지) 위험합니다.
- 기본 `/swagger`, `/redoc`, `/scalar`는 너무 쉽게 추측됩니다 — `uriPrefix`에 **무작위 문자열**을 넣고 `enable` / 내부망 / 게이트웨이와 함께 쓰세요. 세부는 각 UI 전용 페이지를 보세요.
- 동적 `openapi: () => generateOpenapi(...)`는 운영과 **같은** `app`을 넘겨야 security / envelope가 실환경과 어긋나지 않습니다.

## 한 앱에 병행

세 가지(또는 둘)를 같은 `WebApp`에 걸 수 있습니다. **prefix는 반드시 구분**하고, 계약 파일은 하나를 공유할 수 있습니다:

```typescript
import { swaggerUI } from '@aomex/swagger-ui';
import { redocUI } from '@aomex/redoc-ui';
import { scalarUI } from '@aomex/scalar-ui';

mount: [ // [!code focus:13]
  swaggerUI({
    openapi: './openapi.json',
    uriPrefix: '/swagger-7c3e9a1f02b48d6e',
  }),
  redocUI({
    openapi: './openapi.json',
    uriPrefix: '/redoc-a1b2c3d4e5f60718',
  }),
  scalarUI({
    openapi: './openapi.json',
    uriPrefix: '/scalar-9f8e7d6c5b4a3210',
  }),
  routers('./src/routers'),
],
```

프로덕션을 내부망만 허용하거나 IP / token으로 막을 때, 세 UI의 `enable`을 같은 조건으로 두세요(복사 또는 함수로 공유). 하나만 열어두는 실수를 피합니다.

## 「계약 생성」과 맞추기

| 계약 출처 | UI가 읽는 방식 |
| --- | --- |
| CI `aomex openapi` 내보내기 | 셋 다 `openapi: './openapi.json'`(또는 yaml) — 라우트 변경 후 다시 내보내기 |
| 런타임 `generateOpenapi` | `openapi: () => generateOpenapi({ routers, app })` — 파일 없음, 같은 `app` 유지 |
| 연동처용 정적 사이트만 | 보통 Redoc + 내보낸 파일; 시도 진입은 내부망에 |

문서 요청마다 전 라우트 스캔은 CPU를 씁니다. 공개 프로덕션 페이지는 대체로 **내보낸 파일 + UI**이고, 개발 기간에는 동적 생성이 편합니다. 전체 내보내기 흐름은 [OpenAPI 생성](/ko/openapi/)을 보세요.

## 선택 빠른 참고

| 질문 | 답 |
| --- | --- |
| 하나만, 시도 필요 | Scalar 또는 Swagger |
| 하나만, 보기 좋은 설명서 | Redoc |
| 제품은 읽기, 개발은 호출 | Redoc + (Swagger 또는 Scalar) |
| 팀이 이미 Swagger 즐겨찾기/녹화 사용 | 당장 바꾸지 말고 Redoc / Scalar만 추가 |
| 공인터넷 스캔 걱정 | 무작위 `uriPrefix` + `enable`, 세 UI 동일 적용 |

설치 후 설정, 프로덕션 `enable`, 무작위 prefix 예시:

- [Swagger UI](/ko/openapi/swagger-ui)
- [Redoc UI](/ko/openapi/redoc-ui)
- [Scalar UI](/ko/openapi/scalar-ui)

## 관련

- [태그](/ko/openapi/tags) · [Markdown 문구](/ko/openapi/markdown)
- [OpenAPI 생성](/ko/openapi/)
- [Swagger UI](/ko/openapi/swagger-ui) · [Redoc UI](/ko/openapi/redoc-ui) · [Scalar UI](/ko/openapi/scalar-ui)