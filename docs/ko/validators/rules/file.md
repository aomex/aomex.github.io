---
outline: deep
---

# rule.file()

Verify **멀티 업로드 파일** (`@aomex/web '): 이미지, 문서의 사진, CSV 가져오기 (출력 가능한 파일 개체).

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오. 업로드 프로세스 [document 업로드] (/ko/web/attach).

```typescript
import { rule } from '@aomex/web';

export const avatarField = rule.file().maxSize('2mb').mimeTypes('image/jpeg', 'image/png');
```

Browser JSON body 의 대안 파일을 업로드 -- 멀티 파트와 [document 업로드] (/ko/web/attach) 이동.

- 채택 후 적절한 파일 객체 (path, 크기, mimetype 등), 버퍼가 아닙니다.
- 이 규칙은 항상 ** 풀그릴 / 기본 - 페이지 및 유형 참조를 기반으로합니다.
- mimeTypes + 마술 숫자가 일치하지 않을 때, 동작은 ballbacktomimettype이 아닙니다.

### maxSize(byte: number | string)

** 디스크를 채울 때 : ** 보호 파일; '20kb'/ '2mb' 또는 바이트.

```typescript
import { rule } from '@aomex/web';

rule.file().maxSize('2mb');
rule.file().maxSize(500_000);
```

### mimeTypes(...tokens | tokens[])

**언제 쓰나요:** ** 이미지는 사진 전용이며, 수입은 CSV 만입니다. 서명은 내용에 근거합니다.

```typescript
import { rule } from '@aomex/web';

rule.file().mimeTypes('.png', 'image/jpeg');
rule.file().mimeTypes(['image/*']);
rule.file().mimeTypes('.csv', 'text/csv');
```

### fallbackToMimetype(enable?: boolean)

**언제 쓰나요:** ** CSV / HTML / 일반 텍스트 안정된 마술 번호없이 - mimeTypes에 대한 클라이언트 콘텐츠 유형에 반환 기본 true.

```typescript
import { rule } from '@aomex/web';

rule.file()
  .mimeTypes('.html', 'text/plain', 'text/csv')
  .fallbackToMimetype();
```

응답 후 임시 파일이 삭제됩니다 - 가능한 한 빨리 행동의 이름 또는 업로드 개체 저장.

일반적인 체인은 [일반 체인] (../chain); [buffer] (./buffer), [stream] (./stream)를 참조하십시오.
