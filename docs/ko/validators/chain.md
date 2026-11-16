---
outline: deep
---

# 공통 체이닝

임의의 `rule.xxx()`에 붙이는 **공통 체인**은 값 전달 여부, null 허용, 기본값, strict 변환, transform, OpenAPI 문서 메타데이터를 다룹니다. `trim`·`min` 같은 **전용** 메서드와는 직교합니다. 전용 동작은 [검증기 목록](./builtins)의 각 전용 문서를 보세요.

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  page: rule.int().min(1).default(1),
  q: rule.string().trim().optional(),
});

// GET ?page=2&q=ada  → { page: 2, q: 'Ada' }（若你还链了 transform）
// GET 省略 page     → { page: 1, q: undefined }
```

페이지 기본값과 선택 검색어는 프로젝트에서 가장 흔한 첫 조합입니다.

- `optional()` 이후 필드 추론에는 보통 `T | undefined`가 보입니다. `default(...)` 이후에는 대개 **값이 항상 있는 형태**이고, 클라이언트가 안 보내도 기본값으로 채워집니다.
- `nullable()`은 null을 별도로 허용합니다. **안 보낸 것**과는 다릅니다. PATCH로 필드를 비울 때 타입은 null이지 undefined가 아닙니다.
- `strict()`이 켜져 있으면 문자열 `'18'`은 `rule.int()`를 통과하기 어렵습니다. query는 거의 항상 문자열로 들어오므로 **query에는 보통 strict를 쓰지 않습니다**.
- `transform(fn)`의 반환 타입이 필드 타입을 대체합니다. `rule.string().transform(...)` 이후 추론되는 것은 string이 아니라 transform 반환값입니다.
- `docs(...)`는 **런타임 타입을 바꾸지 않고** OpenAPI 메타데이터만 바꿉니다.

일부 조합 검증기나 `file`은 `default` / `strict`가 없을 수 있습니다. 해당 전용 문서를 따르세요.

아래 각 메서드마다 **언제 쓰는지**와 복사 가능한 demo가 있습니다. 체인 순서는 타입 제약 → `default` / `optional` → `transform`·`docs` 순이 자연스럽습니다.

### optional()

필드를 안 보내도 됩니다. `undefined`와 기본 빈 문자열 `''`는 흔히 **비어 있음**으로 취급되어, optional이면 통과하고 값은 `undefined`입니다.

**언제 쓰나요:** 목록 필터, PATCH 부분 수정, Console 선택 플래그.

```typescript
import { rule } from '@aomex/common';

// GET /users?q=ada —— q 可以完全不出现
rule.string().trim().optional();
```

이미 [default(...)](#default값-값)가 있으면 `optional()`을 또 쓸 필요는 보통 없습니다. 기본값만으로 충분합니다. 빈 문자열도 **값으로 인정**하려면 [allowEmptyString()](./rules/string)을 쓰세요.

### required()

`optional()`의 반대로, 다시 필수로 만듭니다.

**언제 쓰나요:** 초안 schema에 `partial()`을 적용한 뒤, 정식 제출 시 다시 조이기.

```typescript
import { rule } from '@aomex/common';

const title = rule.string().optional();
title.required();
```

이미 `default(...)`가 있으면 `required()`를 호출해도 **보통** 기본값은 제거되지 않습니다. 빠진 필드는 여전히 기본값을 탑니다.

### nullable()

JSON의 `null`을 허용하고, **안 보낸 것**과 구분합니다.

**언제 쓰나요:** PATCH에서 `null`을 보내면 비우기, 안 보내면 변경 없음.

```typescript
import { rule } from '@aomex/common';

rule.string().nullable().optional();
// null → 清空；没传 → undefined，业务里跳过该字段

rule.int().nullable();
```

`nullable()`이 없으면 `null`이 때로 **비어 있음**으로 처리될 수 있습니다. 타입 힌트를 따르세요.

PATCH에서 필드를 비우려면 `nullable()`과 `null`을 보내고, 변경 없음은 안 보냄 → `undefined`로 구분하세요. `optional()`만 쓰고 둘을 혼동하지 마세요.

### default(값 | () => 값)

안 보냈거나 비어 있으면 기본값을 쓰며, 필드는 필수가 아닙니다. 기본값 자체는 **보통 다시 타입 검증을 거치지 않습니다**.

**언제 쓰나요:** 페이지네이션, 정렬, 새 리소스 초기 상태.

```typescript
import { rule } from '@aomex/common';

rule.int().min(1).default(1); // [!code highlight]
rule.enum(['asc', 'desc']).default('desc');
rule.date().default(() => {
  return new Date();
});
```

기본값은 함수일 수 있으며, 검증 시점에 호출됩니다. **현재 시각**, 설정 읽기에 적합합니다. 로그에는 «클라이언트가 안 보냄»이 기본값으로 보일 수 있으니, 트러블슈팅 시 기억하세요.

### strict(is?: boolean)

더 엄격한 타입 계약입니다. 문자열이 조용히 숫자로 바뀌는 등 느슨한 변환을 줄입니다.

**언제 쓰나요:** JSON body 계약이 엄격할 때. **query / 폼**은 거의 전부 문자열이므로 보통 끕니다.

```typescript
import { rule } from '@aomex/common';

rule.int().strict();
// '18' → 失败

rule.object({ id: rule.int() }).strict();
```

`strict(false)`로 끌 수 있습니다. 모든 팩토리에 이 체인이 있는 것은 아닙니다(많은 boolean 시나리오는 strict가 없습니다).

::: warning
query / 폼은 거의 전부 문자열입니다. query에 `strict()`를 걸면 페이지 전체가 400이 되는 경우가 흔합니다.
:::

### transform(fn)

검증(기본값 포함)이 끝난 뒤 원하는 형태로 바꿉니다. **추론 타입은 반환값을 따릅니다**.

**언제 쓰나요:** query의 CSV, 대소문자 정규화, 엔트리에서 비즈니스 enum으로 변환.

```typescript
import { rule } from '@aomex/common';

rule.string().transform((s) => {
  return s.split(',').map((x) => {
    return x.trim();
  });
}); // [!code highlight]

rule.string().optional().transform((s) => {
  return s ?? '';
});
```

`Promise`를 반환할 수 있습니다. transform에서 권한·할당량 같은 비즈니스 판단은 하지 마세요. 실패 경로가 불명확합니다. action / 서비스 계층에 두세요. transform이 있는 schema에 인자 없는 [partial()](./schema#partial)이 제한될 수 있으니, 필드 이름을 지정한 `partial`을 쓰세요.

### docs(schema, mode?)

OpenAPI `description` / `example` 등을 씁니다. **런타임에는 영향 없습니다**.

**언제 쓰나요:** 프론트 연동·문서 생성 시 필드 설명이 읽기 쉬워야 할 때.

```typescript
import { rule } from '@aomex/common';

rule.string().docs({ description: '用户昵称', example: 'Ada' });
rule.string().docs({ title: 'Name' }, 'replace');
```

`docs()`는 OpenAPI 메타데이터만 바꿉니다. **런타임 검증 동작은 바뀌지 않습니다**.

| 매개변수 | 언제 쓰나요 |
| --- | --- |
| `mode: 'merge'`（기본） | 기존 docs에 이어 붙이기 |
| `mode: 'replace'` | 통째로 덮어쓰기 |

### Validator.has(source, Type)

정적 메서드로, 검증기나 필드 표에 특정 검증기 클래스가 **중첩 포함**되는지 탐지합니다.

**언제 쓰나요:** 플러그인·코드 생성 시 가끔. 비즈니스 action에서는 거의 불필요.

```typescript
import { Validator, rule, StringValidator } from '@aomex/common';

Validator.has(rule.string(), StringValidator);
Validator.has({ nest: { name: rule.string() } }, StringValidator);
```

## 다음 단계

- [schema](./schema)（partial / pick / extend）
- [검증기 목록](./builtins)（작업별 `rule.xxx()` 찾기）
- [쿼리 파라미터](/ko/web/query) / [요청 본문](/ko/web/body)（체인 규칙을 라우트에 걸기）