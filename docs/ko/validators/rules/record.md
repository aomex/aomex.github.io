---
outline: deep
---

# rule.record()

Expression ** `Record<streaming, V> **: 기능 스위치 보드, 다국어 스크립트, 라벨 무게 — 변수 이름, 값의 균일 한 유형.

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오.

```typescript
import { rule, schema } from '@aomex/common';

export const flagsSchema = schema({
  features: rule.record(rule.boolean()), // [!code highlight]
});
// { darkMode: true, beta: false } → 通过
```

- Equivalent `rule.object().additional({value}}', "any string key + 고정 값 타입"에 추가됨.
-**value** 규칙에 Min/선택.
- 규칙의 유일한 사슬; 선택/기본은 [일반적인 사슬] (../chain)를 보십시오.

일반적인 사슬은 [일반적인 사슬] (../chain); [object] (./object), [any] (./any), [bolean] (./bolean)에서 있습니다.
