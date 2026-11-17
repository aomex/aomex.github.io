---
outline: deep
---

# OpenAPI 문서 생성

라우트에 **계약을 선언**한 뒤 **라우트를 스캔해 OpenAPI 3.0**을 내어 연동·CI에 씁니다. Swagger / Redoc은 「이 JSON을 어떻게 볼지」일 뿐이고, 생성 파이프라인 자체는 `@aomex/openapi`에 있습니다. Web 프로세스에서는 `generateOpenapi`를 쓰고, 파일로 남기려면 [Console 내보내기](/ko/console/openapi)를 보세요.

라우트에 query / body / response를 안 걸면 문서 해당 구간도 비어 있습니다 — 런타임은 그대로 돌아가지만 계약은 불완전합니다. `send` / `throw` 타입 좁히기는 [응답 제약](/ko/web/response)을 보세요.

```bash
pnpm add @aomex/openapi
```

목록·상세 등 라우트에 검증기와 `response()`를 걸고 `generateOpenapi`를 호출하면 커밋 가능한 `openapi.json`(또는 메모리 `Document`)을 얻습니다. **운영과 같은 `WebApp` 인스턴스**(`app`)를 넘기면 생성기가 전역 `mount`와 `envelope`를 읽어 security, 오류 본문, 래핑이 실제 환경과 어긋나기 어렵습니다.

## 라우트에 response와 docs

계약은 라우트 선언에서 옵니다. `query` / `body` / `params`가 입력 schema를 정하고, `response()`가 상태별 출구를 쓰며, `docs`가 summary와 tags를 씁니다. 런타임 검증·타입 좁히기와 문서가 같은 출처이고, 빠진 구간은 openapi.json에서도 비어 있습니다.

```typescript
// src/routers/user.ts
import { rule } from '@aomex/common';
import { query, response, Router } from '@aomex/web';

export const router = new Router({
  prefix: '/users',
  docs: { tags: ['User'] },
});

router.get('/', {
  docs: { summary: '用户列表' },
  mount: [query({ page: rule.int().min(1).default(1) })],
  action: async (ctx) => {
    ctx.send([]);
  },
});

router.get('/:id', { // [!code focus:14]
  docs: { summary: '用户详情' },
  mount: [
    response({ // [!code highlight]
      statusCode: 200,
      description: '找到用户',
      content: { id: rule.int(), name: rule.string() },
    }),
    response({ statusCode: 404, description: '不存在' }),
  ],
  action: async (ctx) => {
    // …
  },
});
```

## app으로 Document 생성

`generateOpenapi`에는 **`WebApp` 인스턴스**가 필요하며, `mount` 배열을 따로 넘기지 않습니다. `app`에서 전역 미들웨어와 [응답 래핑](/ko/web/envelope)을 읽어 OpenAPI 주입의 단일 출처로 씁니다.

CLI·테스트·스크립트가 이 모듈을 `import`할 때는 `new WebApp(...)`과 `app.listen(...)`을 **분리**하세요(또는 실제 프로세스 진입점에서만 listen). 그렇지 않으면 import만으로 서버가 떠 포트를 잡습니다.

```typescript
// src/app.ts —— 只创建并导出，不 listen
import { formatError, routers, WebApp } from '@aomex/web';
import { rule } from '@aomex/common';
import { services } from './services/index.js';

export const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:12]
    formatError({
      content: { code: rule.string(), message: rule.string() },
      handler(err) {
        return {
          code: err.code ?? 'ERROR',
          message: err.message,
        };
      },
    }),
    routers('./src/routers'),
  ],
});
```

```typescript
// src/main.ts —— 进程入口才听端口
import { app } from './app.js';

app.listen(3000);
```

```typescript
import { writeFile } from 'node:fs/promises';
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

const document = await generateOpenapi({ // [!code focus:11]
  routers: './src/routers',
  app, // [!code highlight]
  docs: {
    info: { title: 'My API', version: '1.0.0' },
  },
  fix: (doc) => {
    doc.servers = [{ url: 'https://api.example.com' }];
    return;
  },
});

await writeFile('openapi.json', JSON.stringify(document, null, 2));
```

- 라우트에 body / query / params를 걸면 action에서 `ctx.body`, `ctx.query` 등은 이미 좁혀진 타입입니다 — 문서 schema와 같은 출처입니다.
- `response({ statusCode, content })`를 걸면 `ctx.send(200, …)`의 두 번째 인자가 content와 맞아야 합니다. 200을 선언했는데 `send(201)`이면 보통 타입 오류가 납니다.
- 손으로 `openapi.onMethod`만으로 어떤 응답을 보강할 때는 **생성 JSON에만** 영향이 있고 `ctx.send`는 자동으로 좁혀지지 않습니다 — 그때는 타입을 직접 맞추세요.

`response()` 자주 쓰는 필드:

| 필드 | 언제 쓰나 |
| --- | --- |
| `statusCode` | 출구마다 한 번씩(200 / 201 / 204 / 404…) |
| `content` | JSON 성공 본문; `ctx.send`도 함께 좁힘 |
| `contentType` | CSV, HTML, 바이너리 등 비기본 JSON |
| `headers` | `X-Request-Id` 등 문서화 |
| `example` | 문서 사이트 예시; 런타임 영향 없음 |

비 JSON 예시:

```typescript
response({
  statusCode: 200,
  contentType: 'text/csv', // [!code highlight]
  content: rule.string(),
  description: '导出 CSV',
});
```

검증기로 못 쓰는 소수 응답(바이너리 스트림 등)은 해당 라우트에 `openapi.onMethod`가 있는 미들웨어를 걸어 생성 결과만 바꿀 수 있습니다:

```typescript
import { middleware } from '@aomex/common';

export const openapiBinaryFile = middleware.web({ // [!code focus:18]
  fn: async (_ctx, next) => {
    return next();
  },
  openapi: {
    onMethod(methodItem) { // [!code highlight]
      methodItem.responses ||= {};
      methodItem.responses['200'] = {
        description: '文件流',
        content: {
          'application/octet-stream': {
            schema: { type: 'string', format: 'binary' },
          },
        },
      };
    },
  },
});
```

## generateOpenapi와 런타임 출구

`generateOpenapi`는 라우트 디렉터리를 읽고 `app`에서 전역 `mount` / `envelope`를 꺼내 메모리에서 OpenAPI Document를 맞춥니다. 파일로 쓰거나 Swagger/ReDoc에 넣거나 CI diff에 쓸 수 있습니다. HTTP를 **시작하지 않으며** 런타임 ctx를 자동 좁히지도 않습니다 — 좁히기는 여전히 라우트 mount에 달려 있습니다.

| `generateOpenapi` 옵션 | 언제 쓰나 |
| --- | --- |
| `routers` | 필수; Web 라우트 스캔과 같은 glob |
| `app` | 운영과 같은 `WebApp` 인스턴스(mount, envelope 포함) |
| `docs` | `info.title` / `version` / `description` |
| `fix` | `servers`, 연락처, 벤더 확장 보강; 단일 응답은 라우트 `response()` 우선 |

런타임에 동적으로 스펙을 낼 때(자체 `/openapi.json`):

```typescript
import { app } from '../app.js';

router.get('/openapi.json', {
  docs: { showInOpenapi: false },
  action: async (ctx) => {
    const document = await generateOpenapi({ // [!code highlight]
      routers: './src/routers',
      app,
    });
    ctx.send(document);
  },
});
```

요청마다 라우트를 스캔합니다 — 접근이 잦으면 캐시를 두거나 CI 내보내기 + 정적 파일로 바꾸세요.

::: warning
`generateOpenapi`의 `app`은 **필수**(타입상도)이며 운영과 **같은 구성**이어야 합니다(같은 인스턴스가 가장 단순). 빠지면 컴파일이 안 되고, 다른 mount / envelope를 넘기면 문서의 인증, formatError, 래핑이 실제와 맞지 않습니다.
:::

::: tip
Console 내보내기·스크립트 생성도 Web 모듈을 `import`합니다. `new WebApp`과 `app.listen`을 분리해 CLI 실행만으로 HTTP가 뜨지 않게 하세요.
:::

CI·로컬 **고정 내보내기**는 Console: `openapi()` + `aomex openapi`, [OpenAPI 내보내기](/ko/console/openapi) 참고.

브라우저에서 계약을 열려면: [Swagger UI](/ko/plugins/swagger-ui) · [Redoc UI](/ko/plugins/redoc-ui).

라우트에 걸 수 있는 응답은 가능한 `response()`로 유지하고 `fix`로 매 줄 손보지 마세요. `docs.summary` / tags를 빼먹어도 생성은 되지만 연동 측 문서 읽기가 힘듭니다. JSON을 제공하는 라우트는 보통 `docs.showInOpenapi: false`로 스펙이 자기 자신을 재귀 기술하지 않게 합니다.

## 관련

- [응답 제약](/ko/web/response)
- [응답 래핑](/ko/web/envelope)(`app` 전달 시 성공·실패 가지를 200으로 맞춤)
- [오류 형식](/ko/web/errors)
- [OpenAPI 내보내기](/ko/console/openapi)
- [Swagger UI](/ko/plugins/swagger-ui) · [Redoc UI](/ko/plugins/redoc-ui)