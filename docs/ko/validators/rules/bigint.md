---
outline: deep
---

# rule.bigint()

Validation** Big Integer** (bigint): 체인 기반 wei, Snowflake ID, 안전한 정수 범위 위의 카운트.

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오.

```typescript
import { rule, schema } from '@aomex/common';

export const ledgerSchema = schema({
  amountWei: rule.bigint().min(0n), // [!code highlight]
});
// body: { amountWei: '9007199254740992' } → 9007199254740992n
```

- Bitint에 포스트 검열 extrapolation.
- HTTP JSON에는 네이티브 bimint가 없습니다. body는 일반 ** string** 숫자, 비-stract tries conversion입니다.
- Pre-sequencing response.tostrring() 또는 replacer를 사용자 정의합니다.

JSON으로 bigint를 스트레이트하지 마십시오. stringify -- 클라이언트가 타격합니다.

### min(value: bigint, inclusive?: boolean)

** 최소 충전을 할 때 이전 페이지 ID (포함 : false는 엄격하게 더 큰)보다 커서해야합니다.

```typescript
import { rule } from '@aomex/common';

rule.bigint().min(100n);
rule.bigint().min(100n, false);
```

### max(value: bigint, inclusive?: boolean)

**언제 쓰나요:**** 단 하나 천장, 할당량 천장.

```typescript
import { rule } from '@aomex/common';

rule.bigint().min(0n).max(10_000_000_000_000_000_000n);
```

### strict(is?: boolean)

**언제 쓰나요:** ** 진짜 bitint만, 문자열의 가장자리를 차단 '1e3'.

```typescript
import { rule } from '@aomex/common';

rule.bigint().strict();'123' → 失败
```

일반 체인은 [일반 체인] (../chain); [int] (./int), [decimal] (./decimal), [hash] (./hash)에서 발견됩니다.
