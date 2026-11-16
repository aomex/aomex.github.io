---
outline: deep
---

# rule.hash()

**Hashi-style hexadecimal string**(statutory length): contentMd5, etag, Sha256 지문(Hashi, format only).

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오.

```typescript
import { rule, schema } from '@aomex/common';

export const callbackSchema = schema({
  contentMd5: rule.hash('md5').required(), // [!code highlight]
});
// 'd41d8cd98f00b204e9800998ecf8427e' → 通过
```

- 문자열에 포스트 검열 extrapolation.
- Algorithms는 공장에서만 선정됩니다: md5/Sha1/Sha256/Sha512, 0x 또는 Base64와 더불어 등은 보통 실패합니다.

rule.hash ('sha256'); unknown 알고리즘과 같은 플랜트의 두 번째 매개 변수 알고리즘은 실행시 유형 팁과 오류보고에 근거합니다.

일반적인 사슬은 [일반적인 사슬] (../chain); comparable 본 발견됩니다 [string] (./string), [buffer] (./buffer), [file] (./file).
