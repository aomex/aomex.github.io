---
outline: deep
---

# rule.number()

Validation** 제한 번호( decimals 포함)**: 점수, 스케일, 경도, 완료 등과 같은 비 유성 소수점

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오.

```typescript
import { rule, schema } from '@aomex/common';

export const ratingSchema = schema({
  score: rule.number().min(0).max(5).precision(1), // [!code highlight]
});
// body: { score: 4.56 } → 先 toFixed(1) 再比范围，常为 4.6
```

- Nomber (진수 없음; [진수]의 양 (./진수).
- Qury '3.5' 디폴트는 3.5로 변환 할 수 있습니다. stict()는 stict() 을 수신한 후만 번호로 변환합니다.
- 정밀도 (n)는 실제로 수출되는 소수점 장소의 수를 변화합니다.

### min(n, inclusive?: boolean)

**언제 쓰나요:**** 부정적인 무게, 진도, 할인 요인 지면.

```typescript
import { rule } from '@aomex/common';

rule.number().min(0);
rule.number().min(0, false); // 必须 > 0
```

### max(n, inclusive?: boolean)

** 사용 시: ** 5개의 별 모자, 가늠자에서 1를 초과하지 않는, 경도 범위.

```typescript
import { rule } from '@aomex/common';

rule.number().min(0).max(5);
```

### precision(decimals: number)

** 사용할 때 : ** 인터페이스가있는 긴 시리즈의 소수점은 "최대 2"; Min/max에 참여하기 전에 잘라.

```typescript
import { rule } from '@aomex/common';

rule.number().precision(2);
rule.number().min(0).max(100).precision(1);
```

min/max에 참여하기 전에 정밀 toixed cut/round 및 Banker가 변화 또는 비즈니스 수준에서 눈에 띄는 거래에서.

### strict(is?: boolean)

**언제 쓰나요:**** JSON body guarantee is number; 쿼리는 기본 상승을 유지합니다.

```typescript
import { rule } from '@aomex/common';

rule.number().strict();'1.5' → 失败
```

일반 체인은 [일반 체인] (../chain); [int] (./int), [decimal] (./decimal), [bigint] (./bigint)에서 발견됩니다.
