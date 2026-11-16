---
outline: deep
---

# 수동 검증

** non-Web route** 장면에서, arbitrary 데이터와 교차 검사: 단일 측정, 스크립트, 자기 쓰기 중간. 아래는 웹이 몸() / 쿼리를 걸 때 동일합니다. 이것은 'validate'에 대한 항목 포인트입니다.

```typescript
import { validate } from '@aomex/common';
import { createUserSchema } from '../schemas/user.schema.js';

const input = { name: 'Ada', email: 'ada@example.com' };

const user = await validate(input, createUserSchema); // [!code highlight]
// 通过：user 已是 Infer 后的类型
// 失败：抛错（默认行为）
```

`mount: [body (create UserSchema)] `Equivalent to this position of "cut off without closed" , 오류가 HTTP 400을 산출할 수 있음을 제외하고.

유효한 유일한 모양; 재고목록, 허가, 중복 등록은 아직도 서비스/action입니다.

Validate 반환 Promise, omitting an waiting will use Promise as the result.

- 첫번째 모수는 넓은 유형 (구성, 알 수없는, 시험 장비); 성공적인 반환 값은 `Validator에 좁습니다. Infer<typeof 계획'.
- Default throwOnError: true: ** 실패시 반환 값이 없습니다 **, 또는 거품을 잡아 똑바로 이동합니다.
- `[row OnError: false]'는 `{data, error}`를 반환합니다. ** 성공적으로 `error=== Null**를 읽고 `data==NUll`를 보지 마세요. — 합법적인 값은 nulable()이 열릴 수 있습니다.

::: warning
`data = Null`를 사용하여 실패를 판단 할 수 있습니다.
:::

- 실패하고 `throwOnError: false ' , 오류는 일반적으로 `string[] ' , 여러 빨간 단어의 형태로 단일 반환에 적합.

언제 사용할까요?
| --- | --- |
`await valaidate (input, schema) `scripts, 단일 측정, 중간 - 실패 '
|Valaidate (입력, 스키마, { throwOnError: false}) `Managing backstage form to show all ** 오류와 함께
| 'schema`+`validate'/`body()' 규칙은 한 곳에서만 보존합니다.

# 멀리 던지지 마십시오 : 모든 실수를 수집

```typescript
import { validate } from '@aomex/common';
import { createUserSchema } from '../schemas/user.schema.js';

const input = { name: '', email: 'not-email' };

const result = await validate(input, createUserSchema, { throwOnError: false }); // [!code highlight]

if (result.errors === null) {
  await db.user.create(result.data);
} else {
  return { ok: false, errors: result.errors };
}
```

# 경로의 부서

**HTTP 포털 ** body / query / params; ** Cron front check, Single Test data를 실행하는 검증된 판독 프로파일. 규칙은 `src/schemas/ ' 에서 살고 있습니다.

Web API는 Handwritten validate를 쓰고 반복하고 OpenAPI 불완전을 만드는 400를 던집니다 -- 중간에 걸 수 있습니다.

이름 *

- [schema](./schema)
- [일반 사슬](./chain) (현장에 가까운 모양)
- [Errorized format] (/ko/web/errors) (웹에서 오류 후 JSON 봉투)
