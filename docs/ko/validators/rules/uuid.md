---
outline: deep
---

# rule.uuid()

Verify**UID 문자열** (하이픈 포함): 경로: id, parentId, 이벤트 조정 Id.

Universal Chain은 [General Chain] (../chain)을 참조하여 이 규칙의 유일한 목적을 위해 **를 참조하십시오.

```typescript
import { rule, schema } from '@aomex/common';

export const paramsSchema = schema({
  id: rule.uuid('v4'), // [!code highlight]
});
// '550e8400-e29b-41d4-a716-446655440000' → 通过
```

- 문자열에 포스트 검열 extrapolation.
- 식물은 v1-v8 또는 배열을 제한할 수 있습니다; 일반적인 버전은 쓰지 않을 때 받아들여집니다.
- 케이스는 일반적으로 민감하지 않습니다.

### match(pattern: RegExp)

** 사용할 때 : ** 매우 몇 - UUID는 충분히 좁습니다. 정말 겹 비즈니스 접두사 (기본 프로젝트는 별도의 필드를 적용합니다).

```typescript
import { rule } from '@aomex/common';

rule.uuid('v4').match(/^550e8400-/);
```

일반적인 사슬은 [일반적인 사슬] (../chain); [ulid] (./ulid), [string] (./string), [anyof] (./any-of)를 봅니다.
