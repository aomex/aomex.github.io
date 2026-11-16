---
outline: deep
---

# rule.object()

Verify **Name JSON object**: 프로그램, 임베디드 필드 테이블, 기존 스키마를 더 큰 모양으로 삽입합니다.

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오.

```typescript
import { rule, schema } from '@aomex/common';

export const userBody = schema({
  id: rule.int(),
  profile: rule.object({ // [!code highlight]
    bio: rule.string().optional(),
  }),
});
// 默认白名单：未声明字段会被丢掉
```

기본값은 undeclared 필드를 discard에 사용할 수 있습니다. — 클라이언트 멀티 전송 필드는 “실행적으로 사라질 것”이며 서비스 제공 업체로 잘못되지 않습니다.

- 필드 테이블은 extrapolation 모양을 결정합니다. 임베디드 세트는 rule.object({) 또는 nud {key: rule...}을 쓸 수 있습니다.
- 추가()는 규칙에 따라 여분의 키를 유지하거나 유지하며, 유형은 넓습니다.
- ParseFromString은 성공 후 객체 유형을 유지합니다.

### additional()

**언제 쓰나요:** ** 원래 Webhook은 누출되고 프록시 생성 된 키도 라이브러리에 입력됩니다 (현재 목록은 흰색이 가능하도록 권장됩니다).

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).additional();
// { id: 1, traceId: 'x' } → 两者都保留
```

### additional({ key?, value? })

**언제 쓰나요:** ** 메타 * 키 만 추가 값은 문자열이어야하며 선언 된 필드 + 균질 확장 백.

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).additional({ key: /^(meta|ext)_/ });
rule.object().additional({ value: rule.string() });
rule.object({ id: rule.int() }).additional({ value: rule.number() });
```

동적 키가 균질이며 고정 필드가 없으면 [record] (./record)에 선호됩니다.

### parseFromString(is?: boolean)

** flyer={"status": "on"}과 같은 단일 문자열로 JSON을 삽입할 때.

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).parseFromString();
// '{"id":1}' → { id: 1 }
```

### strict(is?: boolean)

** 사용할 때 : ** 몸은 이미 객체입니다; 부적절한 JSON으로 정규 문자열을 방지하기 위해 (다른 parseFromString (true)).

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).strict();
```

동일한 동적 키는 하드 대상이 아닙니다() 빈 공장, [record](./record).

일반적인 사슬은 [일반 사슬] (../chain); [record] (./record), [array] (./array), [oneof] (./one-of-f)에서 있습니다.
