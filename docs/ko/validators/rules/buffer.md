---
outline: deep
---

# rule.buffer()

Verification **Node.js 버퍼 **: 로그인 hex, 암호화 된 텍스트, 쿼리 작업의 원래 바이트 (Jack의 발명 버퍼).

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오.

```typescript
import { rule, schema } from '@aomex/common';

export const attestationSchema = schema({
  signature: rule.buffer().parseFrom('base64').required(), // [!code highlight]
});
// 'SGVsbG8=' → Buffer
```

- 버퍼만 허용하는 기본값; JSON 문자열은 parseFrom없이 자동으로 회전하지 않습니다.
- ParseFrom ('hex', 'base64')는 버퍼가 계속됩니다.
- 브라우저 JSON 몸은 직접 버퍼를 통과 할 수 없습니다 - 거의 모든 문자열로 이동 + parseFrom.

### parseFrom(...encodings: 'hex' | 'base64')

**언제 쓰나요:** ** REST JSON to send hex 서명, case64 사진의 바이트; 여러 부산물 시도를 나열할 수 있습니다.

```typescript
import { rule } from '@aomex/common';

rule.buffer().parseFrom('base64').required();
rule.buffer().parseFrom('hex', 'base64');
```

use [string] (./streaming) + match or Fixed [hash] (./hash) only if the "hex-like string" 버퍼를 회전하지 않습니다.

일반 체인은 [일반 체인] (../chain); [파일] (./file), [hash] (./hash), [string] (./string)에서 찾을 수 있습니다.
