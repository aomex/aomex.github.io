---
outline: deep
---

# OpenAPI 생성

**라우트에 계약 선언** → **라우트 스캔으로 OpenAPI 3.0**—Swagger/Redoc·클라이언트 생성용. 런타임 UI는 [Swagger UI](/ko/plugins/swagger-ui); Console 내보내기는 [OpenAPI 내보내기](/ko/console/openapi).

```bash
pnpm add @aomex/openapi
```

목록·상세 라우트에 validator와 `response()`를 걸고 `generateOpenapi`를 호출하면 커밋 가능한 `openapi.json`(또는 메모리 `Document`)을 얻습니다.

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

## Document에 app 전달

`generateOpenapi`는 **`WebApp` 인스턴스**를 원합니다—전역 mount/envelope이 있는 `mount` 배열을 또 넘기지 마세요.

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

- `body` / `query` / `params` 이후 action에서 `ctx.body` / `ctx.query`가 좁혀집니다—문서와 같은 schema.
- `response()` 이후 응답 schema가 타입·문서에 반영됩니다.

```typescript
response({
  statusCode: 200,
  contentType: 'text/csv', // [!code highlight]
  content: rule.string(),
  description: '导出 CSV',
});
```

validator로 응답을 못 쓰는 경우(바이너리 스트림) `openapi.onMethod` 미들웨어로 생성물을 패치합니다.

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

## generateOpenapi vs 런타임

`generateOpenapi`는 라우트 디렉터리와 `app` 전역 `mount` / `envelope`를 읽고 Document를 만듭니다. 런타임 Swagger는 often 파일이나 캐시된 Document를 읽습니다.

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

매 요청 스캔은 비쌉니다—캐시 또는 CI 내보내기+정적 파일.

::: warning
`generateOpenapi`의 `app`은 프로덕션과 같아야 security·envelope이 맞습니다.
:::

## 관련

- [Swagger UI](/ko/plugins/swagger-ui)
- [OpenAPI 내보내기](/ko/console/openapi)