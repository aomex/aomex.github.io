---
outline: deep
---

# rule.allOf()

동일한 입력은 ** 동일한 시간에 배열 **에 있는 각 규칙을 만족해야 합니다; 그것은 팀, API 중요한 체재 superimpose에서 암호 클립을 재사용하는 것이 적합합니다.

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오.

```typescript
import { rule, schema } from '@aomex/common';

const passwordBase = rule.string().length({ min: 8, max: 72 });
const passwordDigit = rule.string().match(/\d/);

export const registerSchema = schema({
  password: rule.allOf([passwordBase, passwordDigit]).required(), // [!code highlight]
});
// 'passw0rd!' → 通过；'short' → 失败
```

- 규칙 산출 유형의 가정 ** 십자가 ** (일반적으로 균질 끈 더미 규칙).
- 독점 체인 없음.
- 연속 텍스트 (s) readability는 종종 단일 필드에 더 나은; allof 힘은 ** 교차 파일 재사용 ** 세그먼트.

일반 체인은 [일반 체인] (../chain); [string] (./string), [anyof] (./any-of), [oneof] (./one-of-f)에서 발견됩니다.
