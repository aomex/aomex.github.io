---
outline: deep
---

# rule.enum()

필드를 **유한 집합**으로 제한합니다: status, sort, role（OpenAPI enum에 반영）.

공통 체인은 [공통 체인](../chain)을 보세요. 아래는 **이 규칙 전용** 메서드만 적습니다.

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  sort: rule.enum(['asc', 'desc']).default('desc'), // [!code highlight]
});
// ?sort=asc → 'asc'；잘못된 값 → 실패
```

- 배열 인자는 리터럴 유니온으로 추론됩니다（예: `'asc' | 'desc'`）.
- pick / omit은 새 enum 검증기를 만들며, optional / default을 자주 유지합니다.
- pick / omit 결과가 비거나 default가 집합 밖이면 설정 시점에 예외가 납니다.

이미 TypeScript `enum`（또는 `as const` 열거 객체）가 있으면 `rule.enum`에 그대로 넘기면 됩니다. 배열을 다시 적을 필요 없습니다:

```typescript
import { rule, schema } from '@aomex/common';

enum Color {
  Red = 'red',
  Blue = 'blue',
}

export const patchBody = schema({
  color: rule.enum(Color), // [!code highlight]
});
// { color: 'red' } → Color.Red；'green' → 실패
```

통과 후 타입은 enum 멤버（`Color`）이지, 맨 리터럴 `'red' | 'blue'`가 아닙니다——`ctx.body.color`를 `Color.Red`와 바로 비교할 수 있습니다. 숫자 enum도 같고, 추론은 `Status`입니다:

```typescript
import { rule } from '@aomex/common';

enum Status {
  Off = 0,
  On = 1,
}

rule.enum(Status); // → Status
```

`enum` 키워드 없이 상수 객체만 있을 때는 `as const`를 붙인 뒤 넘기면 되고, 추론은 값 유니온입니다:

```typescript
import { rule } from '@aomex/common';

const Role = { Admin: 'admin', User: 'user' } as const;

rule.enum(Role); // → 'admin' | 'user'
```

객체 값은 string / number만 가능합니다. 불리언은 배열 형태 `rule.enum([true, false])`를 쓰세요.

### pick(...values | values[])

**언제 쓰나요:** 전체 상태는 관리단; 사용자 공개 API는 draft → published만 허용.

```typescript
import { rule } from '@aomex/common';

const status = rule.enum(['draft', 'published', 'archived']);
status.pick('draft', 'published');
status.pick(['draft', 'published']);
```

TS enum을 넘겼다면 pick / omit은 멤버 자체를 쓰면 됩니다: `rule.enum(Color).pick(Color.Red, Color.Blue)`.

### omit(...values | values[])

**언제 쓰나요:** 생성 시 archived 선택 불가; 필터 UI에서 내부 상태 제외.

```typescript
import { rule } from '@aomex/common';

rule.enum(['draft', 'published', 'archived']).omit('archived');
```

default를 바꾼 뒤에도 pick/omit 이후 집합 안에 남겨 두세요.

### strict(is?: boolean)

**언제 쓰나요:** 숫자 enum이고 body가 이미 number일 때; query 문자열은 기본（비엄격）을 두는 경우가 많습니다.

```typescript
import { rule } from '@aomex/common';

rule.enum([0, 1, 2]).strict();
// '1' → 실패；1 → 통과
```

공통 체인은 [공통 체인](../chain); [literal](./literal), [oneOf](./one-of), [string](./string).
