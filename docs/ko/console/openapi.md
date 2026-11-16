---
outline: deep
---

# OpenAPI 내보내기

**HTTP 프로세스를 바꾸지 않고** Console 명령 한 줄로 라우트에서 스캔한 계약을 **파일로** 씁니다. CI, SDK, 문서 사이트용입니다. 라우트 선언과 `generateOpenapi` 사용은 Web 쪽 [OpenAPI 생성](/ko/plugins/openapi)을 보세요.

```bash
pnpm add @aomex/openapi
```

`ConsoleApp` `mount`에 `openapi({ routers, app, saveToFile, … })`를 걸고 로컬·파이프라인에서 `aomex openapi`를 실행하면 `openapi.json`(또는 지정 경로)을 얻습니다. `app`에는 운영과 **같은** `WebApp`을 넘기면 전역 미들웨어와 [envelope](/ko/web/envelope)가 계약에 포함됩니다.

`app`을 넘길 때 `new WebApp(...)`과 `app.listen(...)`을 **분리**하세요(또는 listen은 진입점만). 그렇지 않으면 Console이 Web 모듈을 import할 때 부수 효과로 서버가 뜰 수 있습니다.

```typescript
// src/app.ts —— 只导出 WebApp，不 listen
import { formatError, routers, WebApp } from '@aomex/web';
import { services } from './services/index.js';

export const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [formatError({ /* … */ }), routers('./src/routers')],
});
```

```typescript
// src/cli.ts
import { openapi } from '@aomex/openapi';
import { commanders, ConsoleApp } from '@aomex/console';
import { app } from './app.js';

new ConsoleApp({
  services,
  logger: services.logger,
  language: 'zh-CN',
  mount: [
    openapi({ // [!code focus:18]
      routers: './src/routers',
      app, // [!code highlight]
      saveToFile: 'openapi.json',
      docs: {
        info: {
          title: 'My API',
          version: '1.0.0',
        },
      },
      fix: (doc) => {
        doc.servers = [{ url: 'https://api.example.com' }];
        return;
      },
    }),
    commanders('./src/commanders'),
  ],
});
```

```bash
npx aomex openapi
# 脚手架里常见：pnpm aomex openapi
```

성공하면 현재 작업 디렉터리(또는 설정 경로)에 계약 파일이 생깁니다.

Console 경로는 **배치 파일 쓰기**가 핵심이며 Web 라우트처럼 `ctx`를 좁히지 않습니다. 비즈니스 라우트의 body/response 타입 좁히기는 그대로이고, 내보내기 명령은 같은 라우트 정의 + `app` 전역 설정으로 JSON을 만듭니다.

::: warning
`saveToFile` 경로는 CI 산출물 디렉터리와 맞추세요. 그렇지 않으면 파이프라인이 파일을 못 찾고 SDK는 예전 계약을 씁니다. 라우트나 `app` mount/envelope를 바꾼 뒤에는 `aomex openapi`를 다시 돌려 저장소 계약이 어긋나지 않게 하세요.
:::

## routers와 app

내보내기는 HTTP를 듣지 않지만, 생성 시 **운영과 같은** 라우트 디렉터리와 **같은** `WebApp`(인증, formatError, envelope)이 필요합니다. `routers` glob은 Web과 같습니다. `app`을 빼면 security, 오류 본문, 래퍼 형태가 실제 응답과 어긋나기 쉽습니다.

| 옵션 | 언제 쓰나 | 기본값 |
| --- | --- | --- |
| `routers` | 필수; Web과 같은 glob | — |
| `app` | 운영과 동일한 `WebApp` | — |
| `docs` | `info.title` / `version` / `description` | — |
| `fix` | `servers`, 연락처 등 문서 수준 필드 | — |
| `saveToFile` | 출력 경로; CI 보관 | `openapi.json` |

CI 보관 예:

```typescript
import { app } from './app.js';

openapi({
  routers: './src/routers',
  app,
  saveToFile: 'artifacts/openapi.json', // [!code highlight]
  docs: {
    info: { title: 'My API', version: '1.0.0' },
  },
  fix: (doc) => {
    doc.servers = [{ url: 'https://api.example.com' }];
    return;
  },
});
```

## 내보내기 vs 런타임 JSON

| 시나리오 | 방법 |
| --- | --- |
| CI마다 계약 보관 | 이 페이지: `openapi()` + `aomex openapi` |
| 로컬에서 라우트 수정 후 파일 갱신 | 위와 같이 수동 실행 |
| 요청마다 최신 JSON | Web 라우트에서 `generateOpenapi({ routers, app })`, Console 불필요 |

생성 파일은 [Swagger UI](/ko/plugins/swagger-ui) / [Redoc UI](/ko/plugins/redoc-ui)에 넘기거나 저장소에 두고 계약 테스트합니다.

내보내기와 런타임 `/openapi.json`은 다릅니다. 온라인 고빈도 스캔은 CPU를 쓰므로 운영 문서 사이트는 대개 내보내기 + 정적 파일 또는 UI 플러그인을 씁니다.

## 관련

- [OpenAPI 생성](/ko/plugins/openapi)
- [응답 envelope](/ko/web/envelope)
- [Swagger UI](/ko/plugins/swagger-ui)
- [Redoc UI](/ko/plugins/redoc-ui)
