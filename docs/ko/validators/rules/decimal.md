---
outline: deep
---

# rule.decimal()

금액의 유효성, 환율, 세금율 - 피 0.1 + 0.2 이러한 부동점 오류 **default.js**.

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오.

```typescript
import { rule, schema } from '@aomex/common';

export const paySchema = schema({
  amount: rule.decimal().min('0.01').max('50000'), // [!code highlight]
});
// body: { amount: '19.99' } → Decimal 实例
```

- 대부분 Decimal을 통해 실행, 번호.
- 디폴트('0')는 문자열/디지털을 Decimal로 감싸고 기본값으로 설정한다.
- JSON에 대한 응답에서, you usually have to.tostring(), JSON.stringify에 메소드와 객체를 지시하지 않습니다.

OpenAPI / Frontend 유형은 종종 문자열이며, Decimal을 실행하는 동안 작업 경계에서 변환합니다.

### min(value, inclusive?: boolean)

** 최소 지불, 비 부정적 균형, 값은 문자열 / 숫자 / 소수점일 수 있습니다.

```typescript
import { rule } from '@aomex/common';

rule.decimal().min('0.01');
rule.decimal().min(0, false);
```

### max(value, inclusive?: boolean)

** 사용할 때 : ** 단일 캡, 1을 초과하지 않는 할인.

```typescript
import { rule } from '@aomex/common';

rule.decimal().min('0.01').max('50000');
```

### default(value)

** 사용할 때 : ** 0에서 새로운 계정 잔액, 옵션화물 기본 0 (패키지 됨).

```typescript
import { rule } from '@aomex/common';

rule.decimal().default('0');
```

### strict(is?: boolean)

**언제 쓰나요:** ** Decimal의 예는 내부로 전송되었습니다. 외부 HTTP는 일반적으로 기본 문자열을 유지합니다.

```typescript
import { rule } from '@aomex/common';

rule.decimal().strict();'1.5' → 失败
```

유효성 검사 후, 추가 및 subtractions는 Decimal에 여전히 계산되어야하며, 층을 표시하고 nudity 번호로 보존해야합니다.

일반 체인 [일반 체인] (../chain); [number] (./number), [int] (./int), [bigint] (./bigint).
