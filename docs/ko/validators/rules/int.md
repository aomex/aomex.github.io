---
outline: deep
---

# rule.int()

Validation** Integer**: 페이지 번호, 수량, 셀프 서비스 ID, 재고 (보안 정수 포함)

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오.

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  page: rule.int().min(1).default(1), // [!code highlight]
  pageSize: rule.int().min(1).max(100).default(20),
});
// ?page=2 → page 为 2；省略 page → 1
```

- 번호에 추가 된 포스트 검열 및 정수 실행 (Number.isInteger).
- 쿼리는 종종 문자열 '2'를 입력합니다. 기본 비-stract는 2로 전환됩니다.
- 기본적으로 (n) 후에, 클라이언트가 필드를 통과하지 않는 경우 유형에 여전히 숫자가 있습니다.

Number.MAX SAFE INTEGER [bigint](./bigint); 구매 주문의 값, 가격, int 또는 nud[nomber] (./number) 가 소수점, 참조 [decimal](./decimal).

### min(n, inclusive?: boolean)

** 언제: ** 1에서 적어도 1 페이지 번호; 포함: false는 ** n보다 더 큰 것이어야한다.

```typescript
import { rule } from '@aomex/common';

rule.int().min(1).default(1);
rule.int().min(0, false); // 必须 > 0
```

### max(n, inclusive?: boolean)

** 페이지 크기 캡, 일괄 ID 캡.

```typescript
import { rule } from '@aomex/common';

rule.int().min(1).max(100).default(20);
```

이 규칙은 문법 [`number.min ' /`number.max '] (./number)와 같이 정수 번호가 필요합니다.

### strict(is?: boolean)

** 순수한 JSON 몸은 번호입니다; ** query는 보통 ** 또는 '1'를 열지 않습니다.

```typescript
import { rule } from '@aomex/common';

rule.int().strict();'18' → 失败；18 → 通过；18.5 → 失败
```

::: warning
Query opens () 일반적인 self-explosion point - 문자열 페이지 번호는 적합하지 않습니다.
:::

일반 체인 [일반 체인] (../chain); [number] (./number) (진수), [bigint] (./bigint) (최고 정수), [decimal] (./decimal) (값).
