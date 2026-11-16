---
outline: deep
---

# rule.array()

Verify** array**: 라벨 목록, 일괄 ID, 주문 라인(elements는 작은 객체 모양에 포함될 수 있습니다).

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오.

```typescript
import { rule, schema } from '@aomex/common';

export const batchSchema = schema({
  ids: rule.array(rule.int()).length({ max: 100 }), // [!code highlight]
  tags: rule.array(rule.string()).length({ min: 1, max: 20 }),
});
```

- 요소 규칙은 T[]를 결정한다; 객체 모양을 작성할 때 동등한 가격
- OpenAPI UNiqueItems에 영향을 미치는 독특한 방법 (방법 설명 참조).
- ForceToArray 및 쿼리 단일 값은 배열 유형이됩니다.

### length(n | { min?, max? })

**언제 쓰나요:** ** 100개의 배치의 최대와 더불어 적어도 1개의 상표, 및 2개의 위안 경도.

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).length({ min: 1, max: 20 });
rule.array(rule.number()).length(2);
```

### unique()

** 전체 항목 (설정 semantic, 참조 객체); 쓰기 OpenAPI UNiqueItems: true.

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).unique();
// ['a','a'] → 失败
```

독특한 () 참조하여 객체 요소 무게 - 같은 구조가있는 두 가지 객체는 반복되지 않습니다.

### unique(key)

** 사용할 때 : ** sku / userId에 의해 무거운 라인 객체; 'a.b' 경로 지원하지; OpenAPI UNiqueItems를 작성하지.

```typescript
import { rule } from '@aomex/common';

rule.array({ sku: rule.string(), qty: rule.int() }).unique('sku');
```

### unique(fn)

**언제 쓰나요:** ** 케이스 감지되지 않은 라벨, 하위-integral 필드에 의해 재-heavy.

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).unique((s) => { // [!code highlight]
  return s.toLowerCase();
});
// ['Ada', 'ada'] → 失败
```

### forceToArray('separator', separator?)

**언제 쓰나요:**** 쿼리?tags=a,b,c 또는?ids=1,2,3

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).forceToArray('separator');
rule.array(rule.int()).forceToArray('separator', '|');
```

### forceToArray('block')

**언제 쓰나요:** ** 선택 ** ?tag=news는 문자열이 아닌 ['news'].

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).forceToArray('block');
// 'news' → ['news']
```

쿼리 배열이 forceToArray를 잊을 때, 그것은 polyvalent 형태 400와 disagree하기 쉽습니다.

일반적인 사슬은 [일반적인 사슬] (../chain); [object] (./object), [string] (./string), [int] (./int)에서 있습니다.
