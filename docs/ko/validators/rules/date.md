---
outline: deep
---

# rule.date()

에서 수확 **일 날짜**: 약속 시간, 생일, 시작 및 끝의 보고, 시간 우표.

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오.

```typescript
import { rule, schema } from '@aomex/common';

export const bookingSchema = schema({
  at: rule.date().min(() => { // [!code highlight]
    return new Date();
  }),
});
// ISO 字符串或时间戳 → Date；早于 now → 失败
```

- 날짜에 추가되는 포스트 검열.
- 식물은 Luxon-format 문자열을 통과 할 수 있습니다. 통과하지 않으면 ISO를 더 자주 누르십시오. 기본 시간 스탬프는 파싱 될 수 있습니다.
- Min / max to pass ** Functions**, 각 "현재" 프로세스가 시작될 때 죽음을 피하기 위해 경계를 확인합니다.

### min(freshDate: () => Date, inclusive?: boolean)

**언제 쓰나요:**** 날짜가 아닌 오늘.

```typescript
import { rule } from '@aomex/common';

rule.date().min(() => {
  return new Date();
});
```

::: warning
min / max to pass the function to take the boundary each time; 프로세스의 시작 부분에 min(new Date())을 씁니다.
:::

### max(freshDate: () => Date, inclusive?: boolean)

**언제 쓰나요:**** 미래는 선택될 수 없습니다, 사건 후에 1 년.

```typescript
import { rule } from '@aomex/common';

rule.date().max(() => {
  return new Date();
}); // [!code highlight]

rule.date().max(() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d;
});
```

### parseFromTimestamp(is?: boolean)

**언제 쓰나요:** ** 기본 오픈 - 이동 끝 밀리 초 시간 스탬프; 계약은 ISO에서만 사용할 수 있습니다

```typescript
import { rule } from '@aomex/common';

rule.date(); // 1711257956199 → Date
rule.date().parseFromTimestamp(false);
```

사용자 정의 형식 토큰은 [럭슨 문서] (https://moment.github.io/luxon/#/formatting?id=table-of-tokens)를 참조하십시오.

날짜를 저장하고, 관심사, 사업 및 DB 유형 없는 시간대는, 불쾌한 시간 지역을 둘러싸는 과태 ISO에 의하여 뿐만 아니라 정렬됩니다.

일반 체인은 [일반 체인] (../chain); [int] (./int) (순수한 시간 우표 디지털 필드), [string] (./string)에서 발견됩니다.
