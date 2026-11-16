---
outline: deep
---

# rule.string()

Verify와 좁은**: 별명, 제목, 검색어, 메모.

아래 [General chain] (../chain) 를 참조하세요 ** 이 규칙의 유일한 목적**.

```typescript
import { rule, schema } from '@aomex/common';

export const nicknameSchema = schema({
  displayName: rule.string().trim().length({ min: 1, max: 32 }), // [!code highlight]
  q: rule.string().trim().optional(),
});
// body: { displayName: '  Ada  ' } → displayName 为 'Ada'
```

- Post-validation field extrapolates to the string (변환 반환 유형에 따라 전달, [일반 체인] (../chain)을 참조하십시오.
- 기본 빈 문자열 ' '' "untransmitted"; 옵션과 함께 사용할 때 () 빈 문자열은 종종 정의되지 않습니다.
- AllowEmptyString() 후, '법적 문자열로 유지됩니다.

### trim(is?: boolean)

**언제 쓰나요:**** 테이블, 파스텔, 입력 - 트림은 라이브러리에없는 "좋아"의 값에 발생합니다.

```typescript
import { rule } from '@aomex/common';

rule.string().trim();
rule.string().trim().length({ min: 1, max: 32 });
```

### length(n | { min?, max? })

** 사용할 때 : ** 유효 비트, 암호 최소 길이, 최대 댓글 (JS 문자열 . 길이, UTF-16 야드).

```typescript
import { rule } from '@aomex/common';

rule.string().length(6);
rule.string().length({ min: 8, max: 128 });
```

트리밍과 함께 사용할 때, 길이는 ** 트리밍 ** 후 계산됩니다.

### match(pattern: RegExp)

**언제 쓰나요:** ** 사용자 이름만 알파벳순으로 줄임, 고정 초대 코드 형식을 허용한다. Mailbox / URL / UUID 우선 순위 전문 공장.

```typescript
import { rule } from '@aomex/common';

rule.string().trim().match(/^[a-z][a-z0-9_]{2,31}$/i);
```

메일 박스, URL, IP 등은 일치하지 않습니다 - 전문 공장의 OpenAPI 구문.

### allowEmptyString()

**언제 쓰나요:** ** 검색 상자는 비어있고 여전히 q =이며, 주석은 눈에 띄는 문자열을 허용하고, 프런트 엔드 제어 구성 요소 값 = "" 정렬.

```typescript
import { rule } from '@aomex/common';

rule.string().allowEmptyString().default('');
// '' → ''（通过）；未调用时 optional 下 '' 常当没传
```

옵션(s)에 연결하고 ''를 합법적인 값으로 사용하는 필요는 "allowEmptyString(s)"을 잊지 마세요 -- 그렇지 않으면 빈 문자열은 종종 "untransmitted"입니다.

일반 체인은 [일반 체인] (../chain); 전용 양식은 [email] (./email), [url] (./url), [uuid] (./uuid), [ip] (./ip), [hash] (./hash)에서 찾을 수 있습니다.
