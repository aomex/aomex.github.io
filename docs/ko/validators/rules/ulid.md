---
outline: deep
---

# rule.ulid()

Validation**ULID**(26자, 주문시 대략 시간): orderId, 동기화된 커서 후.

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오.

```typescript
import { rule, schema } from '@aomex/common';

export const orderParams = schema({
  orderId: rule.ulid().required(), // [!code highlight]
});
// '01ARZ3NDEKTSV4RRFFQ69G5FAV' → 通过
```

- 문자열에 포스트 검열 extrapolation.
- 매개변수의 버전과 같은 플랜트 옵션; 독점 체인 없음, 옵션 / 기본 워크 [일반 체인] (.. / 체인).

일반적인 사슬은 [일반 사슬] (../chain); [uuid] (./uuid), [int] (./int), [bigint] (./bigint)에서 있습니다.
