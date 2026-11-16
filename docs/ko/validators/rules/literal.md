---
outline: deep
---

# rule.literal()

참고 요청 ** 정확하게 동일 ** 단어 볼륨 : 웹 북 이벤트, 유형, 고정 동작 : '핑'.

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오.

```typescript
import { rule, schema } from '@aomex/common';

export const pingSchema = schema({
  action: rule.literal('ping'), // [!code highlight]
});
// { action: 'ping' } → 通过；'pong' → 失败；'1' 与 1 不相等
```

- 특정 유형의 단어 볼륨 (예 : '핑')로 인듀스 좁은.
- 타입--'1' 와 1은 다른 지점입니다.
- 독점 체인 없음; 옵션 / 기본 [일반 체인] (. / 체인)을 참조하십시오.

일반적인 사슬은 [일반적인 사슬] (../chain); [enum] (./enum), [oneof] (./one-of-f), [anyof] (./any-of)에서 있습니다.
