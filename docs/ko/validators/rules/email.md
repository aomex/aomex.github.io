---
outline: deep
---

# rule.email()

Validation** Mailbox Form String**: 등록 된 계정 번호, 식별 된 수신자, 초대 메일 (정보 만, mailbox 존재).

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오.

```typescript
import { rule, schema } from '@aomex/common';

export const registerSchema = schema({
  email: rule.email().required(), // [!code highlight]
});
// { email: 'ada@example.com' } → 通过；'ada@' → 失败
```

- Post-included string; OpenAPI 측은 종종 이메일 형식으로 표시됩니다.
- 트림 / 길이가있는 독점적 인 체인이 없습니다 - [transform] (.. / 체인) 또는 작업의 측면에 필요한 경우.

어떤 필드 "must be mailbox"는 자체 공장에서 사용됩니다, 문자열 ().match. 이 게시물은 우리의 특별한 적용 Global Voices 2011의 일부입니다.

### match(pattern: RegExp)

** 언제 사용할 수: ** 비즈니스 등록은 intra-branding list suffixing (그리고 우편함 형식이 통과 한 후 일반 규칙의 접는) 허용.

```typescript
import { rule } from '@aomex/common';

rule.email().match(/@acme\.com$/i);
// 'ada@acme.com' → 通过；'ada@gmail.com' → 格式过、match 失败
```

일치만 접는 형식 제약 및 대체할 수 없습니다 "무효 코드 발급"- 사업 수준에서 성공적인 배달.

일반 체인은 [일반 체인] (../chain); [string] (./string), [url] (./url), [anyof] (./any-of)에서 발견됩니다.
