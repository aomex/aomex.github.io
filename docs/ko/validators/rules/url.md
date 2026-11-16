---
outline: deep
---

# rule.url()

Verify **URL 문자열**: 헤더, 프론트 페이지, 반품 주소, 문서 링크 (기본 http / https).

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오.

```typescript
import { rule, schema } from '@aomex/common';

export const profileSchema = schema({
  avatar: rule.url().optional(), // [!code highlight]
});
// 'https://cdn.example.com/u/1.png' → 通过；'not a url' → 失败
```

- 문자열로 포스트-censor (값은 종종 표준화 된 URL 문자열입니다).
- 계획 ( [...]) 더 보기 Overwrite ** 기본 프로토콜 목록, 추가하지.

### scheme(schemes: string[])

** 사용할 때 : ** 생산은 HTTPS에만 반환; Intranet 미러는 HTTP +https을 허용; 몇 가지 프로토콜 (ftp 등) 볼 수 있습니다.

```typescript
import { rule } from '@aomex/common';

rule.url().scheme(['https']).required();
rule.url().scheme(['https', 'http']);
```

일반 체인은 [일반 체인] (../chain); [email] (./email), [string] (./string), [ip] (./ip)에서 찾을 수 있습니다.
