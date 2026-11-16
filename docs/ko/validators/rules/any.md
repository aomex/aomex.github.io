---
outline: deep
---

# rule.any()

** JSON Snippet for Temporary unconstrained Shape**: 플러그인 설정, 이전/후, 마이그레이션 중 알 수없는 필드.

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오.

```typescript
import { rule, schema } from '@aomex/common';

export const pluginSchema = schema({
  name: rule.string().required(),
  settings: rule.any().optional(), // [!code highlight]
});
// settings 可以是对象、数组、字符串、数字等常见 JSON 形态
```

- 증폭은 넓습니다 (알 수 없는 넓은 조합, 어느것이 컴파일러입니다).
- ctx.body의 소비는 종종 두 번 감소 또는 확인됩니다.
- 독점 체인 없음.

모델링이 [object] (./object) / [record] (./record); 제3자 readjustment 패키지, Admin JSON Blob, transitionable rule.any()에 부여될 수 있을 때 우선 순위. 장기적인 nudity는 OpenAPI와 TS 의미가 없는 -- 이동 후에 좁은 스키마를 만듭니다. 사용 [record], 아니.

일반적인 사슬은 [일반적인 사슬] (../chain); 구조화된 대용암호는 [record] (./record), [oneof] (./one-of-of), [object] (./object)를 보십시오.
