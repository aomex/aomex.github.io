---
outline: deep
---

# rule.stream()

Verify** Readable** (Node Readable): 내보내기 작업 소스, 하위 처리 stdout, 내부 작업 도관 (JMJM body field).

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오.

```typescript
import { Readable } from 'node:stream';
import { rule, schema } from '@aomex/common';

export const exportSchema = schema({
  format: rule.literal('csv'),
  source: rule.stream().required(), // [!code highlight]
});
// Readable.from([...]) → 通过；{ foo: 1 } → 失败
```

- 채택 후에 좁은 것은 읽을 수 있는 시내의 유형입니다 ( validator에 기초를 두어. 인페).
- 독점 체인 없음; 옵션 / 필요 [일반 체인] (. / 체인).
- JSON의 반전 순서는 -- HTTP JSON 경로에 그것을 계산하지 않습니다.

일반적인 사슬은 [일반적인 사슬] (../chain); [file] (./file), [buffer] (./buffer), [literal] (./literal)에서 있습니다.
