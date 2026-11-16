---
outline: deep
---

# 쿼리 문자열

GET(또는 query가 있는 다른 동사)에 `?page=1&keyword=` 같은 값을 선언하려면 라우트 `mount`에 [검증기](/ko/validators/)와 함께 `query()`를 겁니다. 검증 후 action에서 `ctx.query`를 쓰고, 실패 시 **400**이며 action은 실행되지 않습니다.

```typescript
import { rule } from '@aomex/common';
import { query, Router } from '@aomex/web';

export const router = new Router();

router.get('/users', { // [!code focus:13]
  mount: [
    query({ // [!code highlight]
      page: rule.int().min(1).default(1),
      size: rule.int().min(5).max(50).default(10),
      keyword: rule.string().optional(),
    }),
  ],
  action: async (ctx) => {
    const { page, size, keyword } = ctx.query;
    ctx.send({ page, size, keyword, items: [] });
  },
});
```

예: `GET /users?page=2&size=20&keyword=ada`.

`query()` 이후 `ctx.query`에는 선언한 키만 있습니다. `default()`는 빠진 값도 타입상 필수 값(예: `page`는 항상 `number`)이 됩니다. `optional()` 필드는 `undefined`를 포함합니다. `query()` 없이는 `ctx.request.query`처럼 넓은 타입만 있으니 검증된 데이터로 쓰지 마세요. 실패하면 **400**으로 action을 건너뜁니다.

action에서 `Number(ctx.request.query.page)`처럼 직접 파싱하지 마세요—OpenAPI·오류 형식과 어긋나고 타입이 좁혀지지 않습니다.

## 목록 스키마 재사용

여러 목록 API가 `page` / `size` / `q`를 공유하면 `src/schemas/*.schema.ts`에 두고 `query(listQuerySchema)`로 참조하세요. 상한·기본값은 한곳에서 바꾸고 OpenAPI 설명도 같이 따라갑니다.

```typescript
// src/schemas/list-query.schema.ts
import { schema, rule } from '@aomex/common';

export const listQuerySchema = schema({
  page: rule.int().min(1).default(1),
  size: rule.int().max(100).default(20),
  q: rule.string().trim().optional(),
});
```

```typescript
// src/routers/user.ts
import { query, Router } from '@aomex/web';
import { listQuerySchema } from '../schemas/list-query.schema.js';

const router = new Router();

router.get('/users', { // [!code focus:6]
  mount: [query(listQuerySchema)], // [!code highlight]
  action: async (ctx) => {
    const { page, size, q } = ctx.query;
    ctx.send(await searchUsers({ page, size, q }));
  },
});
```

정렬 필드 enum:

```typescript
sort: rule.enum(['name', 'createdAt'] as const).default('createdAt'),
```

rule 또는 라우트에 OpenAPI 설명:

```typescript
page: rule.int().min(1).docs({ description: '页码，从 1 起' }),
```

## body / params와 역할 분리

**query**는 필터·페이지(멱등 GET), **params**는 경로 리소스 ID, **body**는 생성/수정 엔티티입니다. 섞으면 캐시·로그·OpenAPI 의미가 어긋납니다.

| 출처 | 일반적 용도 |
| --- | --- |
| **query** | 필터, 페이지, 정렬—멱등 GET |
| **params** | 경로의 리소스 ID |
| **body** | POST / PUT / PATCH 엔티티 |

큰 JSON 필터를 query에 넣으면 URL·캐시 키가 비대해집니다—POST + `body()`를 고려하세요. POST 생성인데 큰 JSON을 query에 넣는 것도 관례에 어긋납니다.

::: tip
목록 UI는 추적용 파라미터를 자주 보냅니다. query를 지나치게 strict하거나 불필요한 필수 필드를 두면 B2B 연동이 400에 걸리기 쉽습니다. `default()`는 타입에 기본값이 있어도 접근 로그 URL에 `?page=1`이 없을 수 있습니다.
:::

## 다음 단계

- [경로 매개변수](/ko/web/params)
- [요청 본문](/ko/web/body)
- [검증기 체인](/ko/validators/chain): default, optional, transform