---
outline: deep
---

# 요청 본문

POST / PUT / PATCH의 JSON 또는 폼 본문을 명확히 하려면 mount에 `body()`를 걸고 검증기로 필드를 설명합니다. 통과 후 `ctx.body` 타입이 좁혀집니다. 형태가 맞지 않으면 **400**, 본문이 너무 크면 **413**입니다([Web 앱 진입점](/ko/web/)에서 body.payload / body.formData 조정).

```typescript
import { rule } from '@aomex/common';
import { body, Router } from '@aomex/web';

export const router = new Router();

router.post('/users', { // [!code focus:13]
  mount: [
    body({ // [!code highlight]
      username: rule.string().length({ min: 2, max: 32 }),
      age: rule.int().min(0).max(150).optional(),
    }),
  ],
  action: async (ctx) => {
    const { username, age } = ctx.body;
    ctx.send(201, { username, age });
  },
});
```

흔한 Content-Type은 application/json, application/x-www-form-urlencoded, text/\*이고, `rule.file()`이 있으면 multipart/form-data로 파싱합니다.

`body({ username: rule.string(), age: rule.int().optional() })` 이후 `ctx.body.username`은 string, age는 number | undefined입니다. PATCH에 `body(createPostSchema.partial())`를 쓰면 각 필드가 optional이 되지만 규칙은 POST와 같습니다. 루트에 `body(rule.array(...))` 또는 `body(rule.oneOf([...]))`를 쓰면 `ctx.body`는 배열 또는 합집합 타입 전체입니다. `body()` 없이는 `ctx.body`를 검증된 입력으로 쓰지 마세요.

req 스트림을 직접 읽어 JSON.parse하지 마세요. 프레임워크가 이미 파싱한 `ctx.body`와 충돌하고 할당량도 어긋납니다.

## 앱 수준 JSON 상한

`WebApp.body.payload.maxSize`는 **사이트 전역** JSON / 텍스트 본문 크기를 제한합니다. 너무 큰 패킷은 `body()` 검증 전에 거절되어 **413**이 됩니다. 공개 API·웹훅에서 메모리를 보호하려면 여기서 상한을 두세요. 라우트 수준 schema만으로는 «파싱 자체가 안 되는» 경우를 막기 어렵습니다.

공개 API / 웹훅에서 큰 패킷 방지:

```typescript
new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  body: { // [!code focus:3]
    payload: { maxSize: '1mb' }, // [!code highlight]
  },
  mount: [routers('./src/routers')],
});
```

## 루트 배열 본문

클라이언트가 `{ items: [...] }` 대신 **루트 JSON을 배열로** 보내는 경우(일괄 ID, 이벤트 목록)가 있습니다. `body()`에 `rule.array(...)` 또는 전체 schema를 넘기면 통과 후 `ctx.body`가 배열 타입입니다.

일괄 ID, 웹훅 배열 본문:

```typescript
router.post('/batch-delete', {
  mount: [body(rule.array(rule.int()))], // [!code highlight]
  action: async (ctx) => {
    ctx.send({ deleted: ctx.body.length });
  },
});
```

## oneOf 배타 형태

같은 URL에 `type`으로 갈라지는 여러 JSON 형태가 올 수 있지만, 한 순간에는 하나만 맞아야 합니다. `rule.oneOf([...])`는 검증기가 순서대로 시도하고, 정확히 하나만 통과해야 합니다. 둘 다 통과하거나 둘 다 실패하면 **400**입니다.

```typescript
router.post('/events', { // [!code focus:13]
  mount: [
    body( // [!code highlight]
      rule.oneOf([
        rule.object({ type: rule.literal('a'), a: rule.int() }),
        rule.object({ type: rule.literal('b'), b: rule.string() }),
      ]),
    ),
  ],
  action: async (ctx) => {
    ctx.send({ ok: true });
  },
});
```

## 생성과 PATCH

생성에는 전체 schema를, 부분 수정에는 같은 schema의 `.partial()`을 씁니다. PATCH에서 각 필드는 optional이 되지만 규칙은 POST와 공유합니다. `src/schemas/*.schema.ts`로 빼 두면 라우트는 정의 한 곳만 참조해 필드를 바꿀 때 두 곳을 맞출 필요가 없습니다.

```typescript
// src/schemas/post.schema.ts
import { schema, rule } from '@aomex/common';

export const createPostSchema = schema({
  title: rule.string(),
  content: rule.string(),
});
```

```typescript
import { body } from '@aomex/web';
import { createPostSchema } from '../schemas/post.schema.js';

router.post('/posts', { // [!code focus:6]
  mount: [body(createPostSchema)], // [!code highlight]
  action: async (ctx) => {
    ctx.send(201, await createPost(ctx.body));
  },
});

router.patch('/posts/:id', {
  mount: [body(createPostSchema.partial())], // [!code highlight]
  action: async (ctx) => {
    ctx.send(await patchPost(ctx.params.id, ctx.body));
  },
});
```

::: warning
partial()에서는 빈 객체 {}도 통과합니다. «최소 한 필드는 바꿔야 한다»면 action에서 다시 판단하세요. 클라이언트가 Content-Type을 빠뜨리면 빈 body가 {}로 처리될 수 있고, 전부 optional이면 «아무 것도 안 바꿈»이 조용히 통과할 수 있습니다.
:::

## 파일 포함

아바타·첨부는 `rule.file()`을 쓰며, 자세한 내용은 [파일 업로드](/ko/web/attach)를 보세요:

```typescript
router.post('/avatar', { // [!code focus:12]
  mount: [
    body({
      name: rule.string(),
      avatar: rule.file().maxSize('2mb').mimeTypes('image/*'), // [!code highlight]
    }),
  ],
  action: async (ctx) => {
    const { avatar } = ctx.body;
    await saveAvatar(avatar);
    ctx.send({ ok: true });
  },
});
```

| 표기 | 결과 |
| --- | --- |
| `{ avatar: rule.file() }` | 단일 파일, 필드명 = 폼 name |
| `{ photos: rule.array(rule.file()).length({ max: 5 }) }` | 같은 이름으로 여러 part, 최대 5개 |
| 중첩 객체 안의 `rule.file()` | 보통 multipart 평탄 필드명과 맞지 않음 |

필드 수준 maxSize와 앱 formData는 **더 엄격한 쪽**을 따릅니다. 413이면 두 층 설정을 모두 확인하세요.

긴 필터 조건을 POST + `body()`로 바꿀 때는 문서와 캐시 전략을 분명히 하고, GET 의미로 약속하지 마세요.

## 다음 단계

- [파일 업로드](/ko/web/attach)
- [응답 제약](/ko/web/response)
- [Web 앱 진입점](/ko/web/): body 사이트 할당량
