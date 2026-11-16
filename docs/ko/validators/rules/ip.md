---
outline: deep
---

# rule.ip()

검증 ** IP 볼륨**: clitIp, VPN-to-end, 해결사 주소 (V4 / v6 흰색 목록에서 선택).

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오.

```typescript
import { rule, schema } from '@aomex/common';

export const allowlistSchema = schema({
  peer: rule.ip('v4').required(), // [!code highlight]
});
// '203.0.113.10' → 通过；'2001:db8::1' 在只 v4 时 → 失败
```

- 문자열에 포스트 검열 extrapolation.
- ** 공장에서만 버전 ** rule.ip ('v4' |v6' ), .v6() 사슬.

### match(pattern: RegExp)

**언제 쓰나요:** ** IP가 합법적인 후 명백하게 비공개 세그먼트를 차단하려면 (Complex CIDR은 행동을 위한 전문 라이브러리를 사용하는 것이 좋습니다).

```typescript
import { rule } from '@aomex/common';

rule.ip('v4').match(/^10\./);
// '10.0.0.1' → 通过；'203.0.113.1' → 失败
```

일반 체인은 [일반 체인] (../chain); [string] (./string), [url] (./url), [hash] (./hash)에서 발견됩니다.
