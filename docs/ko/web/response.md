---
outline: deep
---

# 응답 제약

한 라우트가 «어떤 상태 코드를 낼 수 있고, 성공 body가 어떤 모양인지»를 선언하려면 mount에 `response()`를 겁니다. 실제로 데이터를 보내는 방식은 바꾸지 않지만 `ctx.send` / `ctx.throw` / `ctx.redirect` 타입이 좁혀지고 OpenAPI에도 씁니다. 200을 선언했는데 `send(201)`이면 컴파일러가 빨갛게 표시하는데, 의도된 동작입니다.

```typescript
import { rule } from '@aomex/common';
import { response, Router } from '@aomex/web';

export const router = new Router();

router.get('/me', { // [!code focus:19]
  mount: [
    response({ // [!code highlight]
      statusCode: 200,
      content: {
        id: rule.int(),
        name: rule.string(),
      },
    }),
    response({ statusCode: 404 }),
  ],
  action: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) {
      return ctx.throw(404, 'not found');
    }
    ctx.send({ id: user.id, name: user.name });
  },
});
```

리소스가 없으면 throw(404), 성공이면 send를 쓰세요. send(404)로 섞지 마세요. `response()`는 컴파일 타임과 문서를 제약할 뿐, 런타임에 send body를 다시 검증하지 **않습니다**.

200 content를 건 뒤에는 `ctx.send({ id, name })`가 검증기 추론과 맞아야 합니다. `response({ statusCode: 404 })`를 선언해야 `ctx.throw(404, …)`가 «허용된 출구»가 됩니다. **201**이나 200이 아닌 다른 2xx는 send에서 **상태 코드를 명시**하고, **204**는 `ctx.send(204)`만 쓰며 `{}`를 넣지 마세요. **3xx**는 `ctx.redirect(status, url)`입니다. `response()`를 여러 번 걸어 성공·오류 상태를 각각 쓸 수 있습니다.

| 상태 코드 | 흔한 보내는 방법 |
| --- | --- |
| `200` | `send(body)` 또는 `send(200, body)` |
| 그 외 2xx | `send(status, body)` |
| 204 등 body 없음 | `send(status)` |
| 3xx | `redirect(status, url)` |
| 4xx / 5xx | `throw(status, …)` |

## 리소스 생성 201

REST에서 «새로 만듦»은 **201**을 쓰고 body에 새 id 등을 넣는 경우가 많습니다. mount에 `response({ statusCode: 201, content: ... })`를 선언하고 action에서 `ctx.send(201, body)`를 쓰면 타입과 OpenAPI가 201을 합법 출구로 봅니다.

```typescript
import { body } from '@aomex/web';

router.post('/users', { // [!code focus:15]
  mount: [
    body({
      name: rule.string().trim().length({ min: 1 }),
    }),
    response({ // [!code highlight]
      statusCode: 201,
      content: { id: rule.int(), name: rule.string() },
    }),
    response({ statusCode: 400 }),
  ],
  action: async (ctx) => {
    const user = await createUser(ctx.body);
    ctx.send(201, { id: user.id, name: user.name });
  },
});
```

## 삭제 성공 204

삭제가 성공했는데 **JSON을 돌려줄 필요 없을** 때 **204 No Content**를 씁니다. `response({ statusCode: 204 })` 후에는 `ctx.send(204)`가 맞고, 204에 `{}`를 넣지 마세요.

```typescript
import { params } from '@aomex/web';

router.delete('/users/:id', {
  mount: [
    params({ id: rule.int().min(1) }),
    response({ statusCode: 204 }), // [!code highlight]
    response({ statusCode: 404 }),
  ],
  action: async (ctx) => {
    const ok = await deleteUser(ctx.params.id);
    if (!ok) {
      return ctx.throw(404);
    }
    ctx.send(204);
  },
});
```

## 리다이렉트 3xx

짧은 URL, 로그인 후 이동, 구 URL 이전 등은 **3xx**와 `ctx.redirect(status, url)`을 씁니다. Location을 손으로 쓰지 마세요. mount에 `response({ statusCode: 302 })`(또는 다른 3xx)를 걸어야 타입이 redirect를 허용 출구로 인식합니다.

```typescript
router.get('/go', {
  mount: [
    response({ statusCode: 302 }), // [!code highlight]
  ],
  action: async (ctx) => {
    ctx.redirect(302, 'https://example.com');
  },
});
```

## 페이지 목록 봉투

목록 API는 200에서 `{ total, items }` 같은 고정 봉투를 쓰는 경우가 많습니다. `response({ statusCode: 200, content: { total, items: rule.array(...) } })`와 [query()](/ko/web/query)로 페이지 입력을 맞추면 프론트와 OpenAPI가 같은 형태를 봅니다.

```typescript
import { query } from '@aomex/web';

router.get('/users', { // [!code focus:22]
  mount: [
    query({
      page: rule.int().min(1).default(1),
      size: rule.int().min(1).max(50).default(20),
    }),
    response({ // [!code highlight]
      statusCode: 200,
      content: {
        total: rule.int(),
        items: rule.array({
          id: rule.int(),
          name: rule.string(),
        }),
      },
    }),
  ],
  action: async (ctx) => {
    const { page, size } = ctx.query;
    const { total, items } = await listUsers({ page, size });
    ctx.send({ total, items });
  },
});
```

검증류 400만 걸고 필드 형태는 안 쓰면, 본문은 전역 formatError와 맞추는 경우가 많습니다:

```typescript
response({ statusCode: 400 }),
```

SSE, 순 텍스트 등 특수 미디어 타입:

```typescript
response({
  statusCode: 200,
  contentType: 'text/event-stream', // [!code highlight]
  content: rule.string(),
}),
```

## 응답 래핑 건너뛰기

사이트에 [envelope](/ko/web/envelope)가 설정된 경우, 특정 상태 코드만 **맨으로** 내보내려면 해당 `response()`에 `skipEnvelope: true`를 붙입니다. 이 선언의 `statusCode`만 영향을 받고, 같은 라우트의 다른 상태는 계속 래핑됩니다. 런타임과 OpenAPI에 함께 기록됩니다.

```typescript
router.get('/report.pdf', { // [!code focus:12]
  mount: [
    response({
      statusCode: 200,
      contentType: 'application/pdf',
      content: rule.string(),
      skipEnvelope: true, // [!code highlight]
    }),
    response({ statusCode: 404 }),
  ],
  action: async (ctx) => {
    ctx.send(await loadPdf());
  },
});
```

문서 페이지, 맨 OpenAPI JSON 같은 인프라 출구는 action에서 `ctx.response.skipEnvelope = true`로 이번 응답을 무조건 스킵할 수도 있습니다. 업무 라우트는 위 옵션을 우선해 문서 누락을 피하세요.

`response()` 없이도 `ctx.send`는 됩니다. 배포 전 성공 상태와 흔한 400/404를 보완해 OpenAPI·타입에 응답 구멍이 없게 하세요. 200을 선언했는데 action에서 `send(201)`이면 타입 오류가 납니다. 상태 코드를 바꾸거나 `response()` 선언을 바꾸세요.

## 다음 단계

- [오류 형식](/ko/web/errors)(4xx/5xx JSON과 response 연동)
- [응답 본문 래핑](/ko/web/envelope)(바깥 200 고정, body 통일 껍데기; `skipEnvelope`)
- [요청 본문](/ko/web/body) / [쿼리 문자열](/ko/web/query)(입력 쪽 대칭 표기)
- [OpenAPI 문서 생성](/ko/plugins/openapi)
