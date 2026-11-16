---
outline: deep
---

# rule.boolean()

**Boolean**: Admin가 게시됨, ?featured=1, JSON.

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오.

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  published: rule.boolean().default(false), // [!code highlight]
});
// ?published=1 → true；省略 → false
```

- boolean에 추가된 포스트 검열.
- 주의/false 얼굴 금액(예: `true', 1)은 boolean로 맵핑됩니다. 목록은 목록 내부에 있는 경우에만 수정됩니다.
- 기본적으로 (false) 후, 필드가 없을 때 여전히 불린 유형이 있습니다.

침묵하는 심각도 값은 1 / '1' / true / 'true' 및 false 값 0 / '0' / false / 'face'로 구성됩니다. Tri-state UI (unselected/Yes/ no)는 boolean에 플러그가 없습니다 - 사용 옵션 () 또는 독립 필드.

### setTruthyValues(values: any[])

** Overwrite** 침묵 값 목록 (추가되지 않음).

**언제 쓰나요:** ** 이전 시스템 또는 HTML은 예 / on / Y 대신 true를 제출합니다.

```typescript
import { rule } from '@aomex/common';

rule.boolean().setTruthyValues(['yes', 'on', 'Y', 1, true]);
// 'on' → true；覆盖后默认的 'true' 可能不再认
```

setTruthyValues만 가짜 값의 목록을 변경하는 것을 잊지 마십시오. "off"또는 all-400 매체가 쉽습니다.

### setFalsyValues(values: any[])

** Overwrite ** 기본 false 값 목록.

** / off에서 실제 값의 목록을 일치 할 때.

```typescript
import { rule } from '@aomex/common';

rule.boolean()
  .setTruthyValues(['yes', 'on', 1, true])
  .setFalsyValues(['no', 'off', 0, false]);
```

두 목록이 직접 실패하지 않는 값; 문자열이 없습니다 () 목록은 느슨합니다.

일반 체인은 [일반 체인] (../chain); 멀티 시리즈 상태는 [enum] (./enum)에서 발견되고 순수한 텍스트 스위치는 [string] (./string)로 알려져 있습니다.
