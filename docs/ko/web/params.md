---
outline: deep
---

# 경로 매개변수

`/users/:id` 같은 라우트가 매칭되면 세그먼트는 `ctx.request.params`에 **문자열**로 들어옵니다. `mount`에 `params()`를 걸어 타입·범위를 검사하고, action에서는 정제된 `ctx.params`를 씁니다. 형식 오류 → **400**, 리소스 없음 → **404**.

```typescript
import { rule } from '@aomex/common';
import { params, Router } from '@aomex/web';

export const router = new Router();

router.get('/users/:id', { // [!code focus:15]
  mount: [
    params({ // [!code highlight]
      id: rule.int().min(1),
    }),
  ],
  action: async (ctx) => {
    const { id } = ctx.params;
    const user = await findUser(id);
    if (!user) {
      ctx.throw(404, 'user not found');
    }
    ctx.send(user);
  },
});
```

`:id`가 아무 문자열이나 받는다고 해서 유효한 ID는 아닙니다. 범위·UUID는 검증기에 두세요. 형식 오류 → **400**, 없음 → **404**; 모니터링에서 오타를 없음으로 처리하기 쉽습니다.

`params({ id: rule.int().min(1) })` 이후 `ctx.params.id`는 `number`입니다. 템플릿 `:userId`면 스키마 키도 `userId`여야 합니다. `params()`가 없으면 문자열뿐이라 `"42"`와 `42`가 섞입니다. 경로가 애초에 매칭되지 않았으면 `params()`는 돌지 않습니다—검증 400이 아니라 404입니다.

경로는 `:userId`인데 `params({ id: ... })`면 키가 어긋납니다. `id`를 query에 중복 두고 query를 우선하지 마세요—경로/query 불일치는 캐시·인증·로그를 망칩니다.

## UUID·다중 세그먼트 경로

공개 UUID ID에는 `rule.uuid()`를 쓰세요. `/users/:userId/posts/:postId`처럼 여러 플레이스홀더는 템플릿 키와 맞는 하나의 `params({ ... })`에 넣습니다.

```typescript
params({ id: rule.uuid() }),
```

```typescript
router.get('/users/:userId/posts/:postId', { // [!code focus:12]
  mount: [
    params({ // [!code highlight]
      userId: rule.int().min(1),
      postId: rule.int().min(1),
    }),
  ],
  action: async (ctx) => {
    const { userId, postId } = ctx.params;
    ctx.send({ userId, postId });
  },
});
```

## 재사용 가능한 param 스키마

여러 라우트에서 `:id`가 반복되면 `params` 형태를 스키마 파일로 빼세요—[body / query 재사용](/ko/web/body)과 같은 패턴입니다. ID 규칙(int → uuid)을 한곳에서 바꿉니다.

```typescript
// src/schemas/user-id-param.schema.ts
import { schema, rule } from '@aomex/common';

export const userIdParamSchema = schema({
  id: rule.uuid(),
});
```

```typescript
import { params } from '@aomex/web';
import { userIdParamSchema } from '../schemas/user-id-param.schema.js';

router.get('/users/:id', { // [!code focus:5]
  mount: [params(userIdParamSchema)], // [!code highlight]
  action: async (ctx) => {
    ctx.send(await findUser(ctx.params.id));
  },
});
```

`params()`를 마운트하면 OpenAPI path 매개변수에 `in: path`와 `required`가 자동으로 붙습니다.

## 다음 단계

- [쿼리 문자열](/ko/web/query)
- [요청 본문](/ko/web/body)
- [HTTP 라우팅](/ko/web/router): `:id`와 공존하는 정적 경로