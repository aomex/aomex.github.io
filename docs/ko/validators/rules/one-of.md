---
outline: deep
---

# rule.oneOf()

참여는 ** 규칙이 될 수 있습니다. 많은 통과 및 실패 할 수 있습니다 (공동, 상호 독점 지불의 분리).

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오.

```typescript
import { rule, schema } from '@aomex/common';

export const payMethodSchema = schema({
  method: rule.oneOf([ // [!code highlight]
    rule.object({
      type: rule.literal('card'),
      last4: rule.string().length(4),
    }),
    rule.object({
      type: rule.literal('balance'),
      amount: rule.decimal().min('0.01'),
    }),
  ]),
});
```

- Infer to branch output type** 결합**.
- 각 분 / 경기 등의 내부 규칙의 조합;이 조합은 독점 체인이 없습니다.
- 독점적 인 semantics의 조합이 없습니다. 옵션 / 비 풀 / 운송 / 문서 사용.

일반 체인 [일반 체인] (.. / 체인); [anyOf] (./any-of), [allOf] (./all-of), [literal] (./literal), [object] (./object).
