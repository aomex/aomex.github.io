---
outline: deep
---

# 검증기

밖에서 들어온 데이터를 믿을 수 있는 형태로 줄입니다: 런타임에 잘못된 값을 막고, TypeScript에서 타입이 좁혀집니다. Web의 `body()` / `query()`, Console의 `options()`, OpenAPI는 보통 **같은 rule 세트**를 쓰므로 interface를 따로 두 벌 관리하지 않아도 됩니다.

```typescript
import { rule, validate, schema, type Validator } from '@aomex/common';
```

```typescript
import { rule, validate } from '@aomex/common';

const input = { name: '  Ada  ', age: '18', hack: true };

const user = await validate(input, { // [!code highlight]
  name: rule.string().trim().length({ min: 1, max: 32 }),
  age: rule.int().min(0).optional(),
});

await doSomething(user);
```

`user`에 마우스를 올리면:

- name → string（trim 적용됨）
- age → number | undefined（`'18'`은 보통 숫자로 변환됨. 선택 필드）
- hack 없음 — 선언하지 않은 키는 기본적으로 버려집니다

라우트에서는 `body({ ... })`를 건 뒤 `ctx.body`가 이미 좁혀진 타입이 되는 경우가 더 흔합니다. `validate`를 직접 쓸 필요가 없습니다.

::: tip
Zod 한 벌 + 손으로 쓴 interface를 같이 유지하지 마세요. 필드가 바뀔 때 가장 쉽게 어긋납니다. 여기서는 rule 한 벌이 런타임과 타입을 함께 담당합니다.
:::

## 프로젝트에서 도구 고르기

| 하려는 일 | 쓰는 것 |
| --- | --- |
| 단일 필드 | `rule.string()` / `rule.int()` … → [검증기 목록](./builtins) |
| 여러 필드 재사용 / PATCH 파생 | [`schema`](./schema), `src/schemas/xxx.schema.ts`에 두기 |
| 스크립트 / 테스트에서 한번 검증 | [수동 검증](./validate) |
| 중첩·배열·택일 | [object](./rules/object) / [array](./rules/array) / [oneOf](./rules/one-of) |
| 전달 여부 / 기본값 / 문서 메모 | [공통 체이닝](./chain) |

임의 키를 진짜로 통과시키려면 [rule.record()](./rules/record)로 명시하세요. 선언하지 않은 필드가 남는다고 기대하면 안 됩니다.

::: warning
`rule.any()`는 동작하지만 타입과 OpenAPI가 흐려집니다. 과도기에는 쓸 수 있으나, 외부 API에는 최대한 남기지 마세요.
:::

## 이 섹션

| 문서 | 언제 볼까 |
| --- | --- |
| [검증기 목록](./builtins) | 구체적인 `rule.xxx` 찾기 |
| [공통 체이닝](./chain) | `optional` / `default` / `transform`… |
| [schema](./schema) | pick / omit / partial |
| [Prisma](/ko/plugins/prisma) | 테이블 구조에서 검증 생성 |
| [수동 검증](./validate) | 스크립트 / 단위 테스트에서 `validate` 직접 호출 |
| [커스텀 검증기](/ko/advanced/validator) | 내장이 부족할 때（고급） |
