---
outline: deep
---

# rule.anyOf()

여러 규칙에서 ** 적어도 하나 ** 충분; 많은 성공적인 (참고: postbox 또는 작업 번호, 검색 q:UUID 또는 slug).

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오.

```typescript
import { rule, schema } from '@aomex/common';

export const loginSchema = schema({
  account: rule.anyOf([ // [!code highlight]
    rule.email(),
    rule.string().match(/^@[a-z0-9_-]+$/i),
  ]).required(),
});
```

- Infer 분기 유형 ** Union**, 단일 문자열보다 더 넓은.
- 독점적인 사슬 없음; 각 사슬의 subrules.
- 당신은 "단 하나"에있을 때 [oneof] (./one-of)를 사용해야합니다 - oneof에 오버랩은 일반적으로 anyof에 실패합니다.

일반적인 체인은 [일반 체인] (../chain); [oneof] (./one-of-), [allof] (./all-of), [email] (./email), [string] (./string)를 참조하십시오.
