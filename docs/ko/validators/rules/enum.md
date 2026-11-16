---
outline: deep
---

# rule.enum()

**Stitus, 정렬, 역할 (input OpenAPI enum).

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오.

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  sort: rule.enum(['asc', 'desc']).default('desc'), // [!code highlight]
});
// ?sort=asc → 'asc'；非法值 → 失败
```

- 공동 단어 수 또는 회원 유형의 수 (TS enum에 전달하면).
- Pick / omit은 새로운 enumerator를 가져오고 옵션 / 기본값을 유지합니다.
- Pick / omit 결과는 비어 있습니다. 또는 기본값은 풀에 있지 않으며 구성 기간은 thrown입니다.

### pick(...values | values[])

**언제 쓰나요:** ** 관리 끝에 전체 질량; 사용자 릴리스 인터페이스는 단지 초안 → 공공을 허용.

```typescript
import { rule } from '@aomex/common';

const status = rule.enum(['draft', 'published', 'archived']);
status.pick('draft', 'published');
status.pick(['draft', 'published']);
```

### omit(...values | values[])

**언제 쓰나요:** ** 생성에 아카이브를 선택할 수 없습니다; 내부 상태를 끌어 필터.

```typescript
import { rule } from '@aomex/common';

rule.enum(['draft', 'published', 'archived']).omit('archived');
```

기본 변경을 기억하기 위해 여전히 선택 후 풀에 떨어졌다/미트.

### strict(is?: boolean)

** 사용할 때 :** 숫자 및 신체는 숫자입니다; 쿼리 문자열은 종종 기본 유지.

```typescript
import { rule } from '@aomex/common';

rule.enum([0, 1, 2]).strict();'1' → 失败；1 → 通过
```

일반적인 사슬은 [일반적인 사슬] (../chain); [literal] (./literal), [oneof] (./one-of), [string] (./string)에서 있습니다.
