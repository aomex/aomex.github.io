---
outline: deep
---

# 빠른 설치

처음부터 실행 가능한 aomex 프로젝트를 만듭니다. HTTP가 동작하고 터미널에서 명령을 실행할 수 있습니다. 비계는 logger, language, 종료 등 필수 항목을 연결해 빈손으로 조립하는 수고를 줄입니다.

```bash
npx create-aomex@latest
cd your-project
pnpm install
pnpm start
```

::: tip 환경
**Node.js ≥ 24** (`node -v`로 확인). 패키지 관리자는 **pnpm**이 가장 수월합니다. npm / yarn도 보통 동작합니다.
:::

기동 후 브라우저에서 헬스 체크나 홈을 호출하세요(포트는 템플릿 `PORT`). 터미널:

```bash
pnpm aomex -h
```

## 프로젝트 구조

비계는 대략 아래와 같습니다(버전마다 조금 다를 수 있음). 세 가지 줄을 기억하세요. `src/web.ts`는 HTTP, `src/cli.ts`는 터미널 / Cron / OpenAPI 내보내기, `src/routers/`와 `src/commanders/`는 라우트와 명령입니다. DB·캐시는 `src/services/`에 두고 **Web·Console이 공유**합니다.

| 파일 / 디렉터리 | 무엇을 바꾸나 |
| --- | --- |
| `src/web.ts` | HTTP 기동 |
| `src/cli.ts` | 터미널 명령 / Cron / OpenAPI 내보내기 |
| `src/routers/` | HTTP 라우트 |
| `src/commanders/` | CLI 명령 |
| `src/services/` | DB, 캐시, 메일 — 라우트 `action`에 SQL 넣지 말 것 |
| `src/schemas/` | 재사용 검증, 파일명 `xxx.schema.ts`(OpenAPI·CLI가 같은 정의 공유) |

```text
src/web.ts          # HTTP 入口
src/cli.ts          # Console / Cron / OpenAPI 落盘
src/routers/        # 接口
src/commanders/     # CLI 指令
src/services/       # Web 与 Console 共用
src/schemas/        # 可复用 rule / schema
```

쓰지 않는 것(prisma, i18n 등)은 지워도 됩니다. 자리 채우기로 남길 필요 없습니다. CORS, 인증, OpenAPI 등은 별도 패키지이며 필요할 때 설치합니다.

## 라우트 한 번 시험

비계에 이미 `src/routers/`가 있습니다. 새 파일에 `export const router = new Router()`, `routers('./src/routers')`가 스캔합니다. action 전에 검증:

```typescript
// src/routers/hello.router.ts
import { rule } from '@aomex/common';
import { query, Router } from '@aomex/web';

export const router = new Router();

router.get('/hello', {
  mount: [
    query({ name: rule.string().default('world') }), // [!code highlight]
  ],
  action: async (ctx) => {
    ctx.send({ message: `hello, ${ctx.query.name}` });
  },
});
```

`pnpm start` 후 `/hello?name=ada` — 이때 `ctx.query.name`은 이미 `string`입니다.

## 명령 한 번 시험

Console과 Web이 services·schemas를 **공유**합니다. `src/commanders/`를 수정하거나 비계 기본 명령을 실행하세요:

```bash
pnpm aomex hello
pnpm aomex hello --user Ada
```

Cron·OpenAPI 내보내기도 `src/cli.ts`를 거칩니다 — [Cron](/ko/plugins/cron) · [OpenAPI 내보내기](/ko/console/openapi).

## 다음 단계

1. [Web 앱 진입점](/ko/web/) — `WebApp` 필수 옵션, language, 종료  
2. [HTTP 라우팅](/ko/web/router) — mount, docs, disabled  
3. [검증기](/ko/validators/) — 필드 검증과 타입 좁히기  
4. [서비스](/ko/core/service) — DB·캐시 위치  
5. [Console 앱 진입점](/ko/console/) — 명령과 Cron
