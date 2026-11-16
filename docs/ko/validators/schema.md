---
outline: deep
---

# schema

"User, order, page break" 필드 폼은 재사용 가능한 단위이며, `src/schemas/xx.schema.ts' , 즉 body(schema)/Query(schema) , `validate(input, schema)' 의 동일한 세트가 테스트됩니다. Infer '유형, 몇몇 사본과 함께 붙여넣기.

```typescript
// src/schemas/user.schema.ts
import { schema, rule, type Validator } from '@aomex/common';

export const userSchema = schema({ // [!code highlight]
  id: rule.int(),
  name: rule.string().trim().length({ min: 1 }),
  email: rule.email(),
  password: rule.string().length({ min: 8 }),
});

export type User = Validator.Infer<typeof userSchema>;
```

```typescript
// src/routers/users.ts
import { body, Router } from '@aomex/web';
import { userSchema } from '../schemas/user.schema.js';

export const router = new Router();

router.post('/register', {
  mount: [body(userSchema.omit('id'))], // [!code highlight]
  action: async (ctx) => {
    await register(ctx.body);
    ctx.send(201);
  },
});
```

필드는 여전히 [일반 체인] (./chain); 다음은 주로 **schema의 자체 ** 방법입니다.

-`Validator. Infer<typeof userSchema'는 승인이 확인 된 후 객체의 유형이며 ctx.body는 응답을 좁습니다.
- Pick / omit / Extend will produce** new** schema and the type will be a new one; OpenAPI 구성 요소는 자동으로 상속되지 않으며, 각각 저장소에 추가됩니다 (...).
- 부분 () 나중에 필드가 선택된다; 비 부분 () 스키마에 누군가가 변환을 걸으면, 유형은 부분 ('name', 'bio')로 전환 할 수 없습니다.
- required() backwards를 바짝 죄기; 필드에 이미 기본값이 있는 경우, 기본값은 여전히 기본값입니다.

- 언제?
| --- | --- |
|schema({) | 초 수확 단위
`asName('User')'OpenAPI `components. 스키마 '
|pick ('email', 'password') | 두 개의 필드만 로그인
`omit ('password')`외부 DTO, 등록 거부 `id' |
|extendd({nickname: 통치.stream(})) |자세한 정보
`Partial()'/`Partial('name')`PATCH 'Draft`PATCH'
`required() / `required('name')`draft to be formally submit '

### asName(name)

Name**는 자동으로 선택 / omit / exampled / 부분 / 필수 결과를 전달하지 않습니다 - 조립 라이브러리를 입력하는 모든 모양은 다시 주문됩니다.

```typescript
export const userSchema = schema({
  id: rule.int(),
  name: rule.string(),
  password: rule.string(),
}).asName('User'); // [!code highlight]

export const publicUserSchema = userSchema.omit('password').asName('PublicUser');
```

### pick / omit

```typescript
import { userSchema } from '../schemas/user.schema.js';

userSchema.pick('email', 'password');
userSchema.omit('password');
```

클라이언트는 등록된 공용영역이 몸 (userSchema)에 직접이고 oit (`id')를 잊는 경우에 1 차적인 열쇠를 바꾸지 않아야 합니다 - schema를 분리하는 공유를 창조하십시오.

### extend

동일한 이름은 수입됩니다; 그것은 분야 명부 또는 다른 schema에 통과될 수 있습니다.

```typescript
export const accountSchema = schema({
  email: rule.email(),
  password: rule.string().length({ min: 8, max: 128 }),
}).asName('Account');

export const registerSchema = accountSchema.extend({ // [!code highlight]
  nickname: rule.string().trim().length({ min: 1, max: 32 }),
});
```

이름으로 새로운 모양을 추가하기 위해 변경, OpenAPI는 여전히 인라인의 조각, $ref에 대한.

### partial / required

```typescript
import { userSchema } from '../schemas/user.schema.js';

userSchema.pick('name', 'email', 'bio').partial(); // [!code highlight]

const draftSchema = userSchema.partial();
draftSchema.required();
draftSchema.required('name', 'email');
```

부분() 스키마에서 누군가가 변형을 걸으면, 유형 또는 실행은 - 부분('name', 'bio')로 변경할 수 있습니다.

# # 리스트 예: 페이지 휴식

```typescript
// src/schemas/list-query.schema.ts
export const listQuerySchema = schema({ // [!code highlight]
  page: rule.int().min(1).default(1),
  pageSize: rule.int().min(1).max(100).default(20),
  q: rule.string().trim().optional(),
});
```

Page / PageSize에는 기본값이 있습니다. 클라이언트는 omitted 일 수 있습니다. 로그는 기본값으로 표시됩니다.

웹 라우터는 몸 / 쿼리 대신 Handwritten validate 및 throw 400 -- 더 균일 한 유형과 잘못된 봉투를 걸 수 있습니다.

언어 및 언어의 응용 프로그램을 위해 [Web] (/ko/web/#language) [Console] (/ko/console/#language)를 참조하십시오.

이름 *

- [수입확인](./validate) (script, Single-in-schema)
- [object](./rules/object) / [array](./rules/array) / [oneOf](./rules/one-of)
- [요청 본문] (/ko/web/body) / [Query 매개 변수] (/ko/web/query)