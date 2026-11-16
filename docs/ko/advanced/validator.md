---
outline: deep
---

# 사용자 정의 검증기

사번, 검증 숫자 일련번호, 내부 enum 코드 — 같은 형태가 body, query, schema, OpenAPI에 반복됩니다. 매번 `rule.string().match(/^E\d{6}$/)`를 쓸 수 있지만:

- 오류 문구가 API마다 달라 연동이 어긋남  
- OpenAPI는 형식 없는 string만 보임  
- 규칙 변경 시 저장소 전체에서 정규식 검색  

이 페이지는 **`rule.employeeId()`**를 한곳에서 검증·타입·문서로 관리하는 방법입니다. 일회성 필드는 [내장 검증기](/ko/validators/builtins)와 [공통 체이닝](/ko/validators/chain)을 쓰세요.

## 목표 모습

성공 시 필드는 `string`; 실패는 자동 400; 문서에 `pattern`과 예시. 라우트에서는:

```typescript
mount: [body({ employeeId: rule.employeeId() })];
```

## 1단계: 클래스 — 런타임만

`src/validators/employee-id.validator.ts`를 만듭니다. OpenAPI·체인 메서드는 나중에 — `accept` / `deny`만 되면 됩니다.

```typescript
// src/validators/employee-id.validator.ts
import { Validator, ValidateResult } from '@aomex/common';

export class EmployeeIdValidator<T = string> extends Validator<T> {
  protected validateValue(
    value: unknown,
    _key: string,
    label: string,
  ): ValidateResult.Any<string> {
    if (typeof value !== 'string' || !/^E\d{6}$/.test(value)) {
      return ValidateResult.deny(`${label}必须是 E + 6 位数字的工号`);
    }
    return ValidateResult.accept(value);
  }
}
```

`ValidateResult.accept(value)`는 통과이며 **여기서 반환한 값**이 이후로 흐릅니다(정규화 가능). `deny` 문자열은 400 envelope로 갑니다.

[수동 검증](/ko/validators/validate)으로 먼저 스모크 테스트 — HTTP 불필요:

```typescript
import { validate } from '@aomex/common';
import { EmployeeIdValidator } from './employee-id.validator.js';

await validate('E123456', new EmployeeIdValidator()); // 通过
// await validate('bad', new EmployeeIdValidator()); // 抛错
```

## 2단계: 체인 메서드 타입 선언

기본 클래스의 `optional` / `default` / `transform` 등은 `protected` 구현입니다. 하위 클래스에서 `declare public` 없이 체인하면 타입이 기본으로 돌아가거나 자동 완성이 사라집니다. 내장 `rule.string()` 선언을 참고하세요(구현은 기본에 있음):

```typescript
import {
  Validator,
  ValidateResult,
  type TransformedValidator,
} from '@aomex/common';

export declare namespace EmployeeIdValidator {
  export interface Options<T> extends Validator.Options<T> {}
}

export class EmployeeIdValidator<T = string> extends Validator<T> {
  declare protected config: EmployeeIdValidator.Options<T>;

  declare public docs: (
    docs: Validator.PartialOpenAPISchema,
    mode?: Validator.DocumentMergeMode,
  ) => this;
  declare public optional: () => EmployeeIdValidator<T | Validator.TOptional>;
  declare public required: () => EmployeeIdValidator<Exclude<T, Validator.TOptional>>;
  declare public nullable: () => EmployeeIdValidator<T | null>;
  declare public default: (
    value: Validator.ParameterOrFn<T>,
  ) => EmployeeIdValidator<T | Validator.TDefault>;
  declare public transform: <T1>(
    fn: Validator.TransformFn<T, T1>,
  ) => TransformedValidator<T1>;

  declare protected copy: () => EmployeeIdValidator<T>;

  protected validateValue(
    value: unknown,
    _key: string,
    label: string,
  ): ValidateResult.Any<string> {
    if (typeof value !== 'string' || !/^E\d{6}$/.test(value)) {
      return ValidateResult.deny(`${label}必须是 E + 6 位数字的工号`);
    }
    return ValidateResult.accept(value);
  }
}
```

`declare protected copy`가 중요합니다. 전용 체인(다음 단계)은 `this.copy()`로 복제하며 반환 타입은 `EmployeeIdValidator`여야 합니다.

## 3단계: `rule.xxx()`에 등록

두 단계 모두 필요:

1. `declare module '@aomex/common'`로 `Rule` 확장 → 편집기가 `rule.employeeId()` 인식  
2. `Rule.register('employeeId', EmployeeIdValidator)` → 런타임 팩토리  

```typescript
import { Rule } from '@aomex/common';

declare module '@aomex/common' {
  export interface Rule {
    employeeId(): EmployeeIdValidator;
  }
}

Rule.register('employeeId', EmployeeIdValidator); // [!code highlight]
```

::: warning
클래스만 있고 `register` 없음: 타입은 맞아 보여도(수동 augment 시) 런타임 `rule.employeeId is not a function`.  
`register`만 있고 `declare module` 없음: 돌아가지만 자동 완성 없고 `any`로 흐름.
:::

등록은 **side-effect**: 모든 `rule.employeeId()` **전에** 실행. schema 상단 `import '../validators/employee-id.validator.js'` 또는 `web.ts` / `cli.ts`에서 한 번 import하는 패턴.

## 4단계: OpenAPI 형태

`toDocument()`를 덮어쓰면 생성 시 `pattern` / `example`이 나옵니다. 없으면 문서는 거의 plain string입니다.

```typescript
import type { OpenAPI } from '@aomex/common';

protected override toDocument(): OpenAPI.SchemaObject {
  return {
    type: 'string',
    pattern: '^E\\d{6}$',
    example: 'E123456',
  };
}
```

(프로젝트에서 `OpenAPI`의 `@aomex/common` import 경로가 타입과 다르면 편집기 「정의로 이동」을 따르세요.)

## 5단계: schema / 라우트 연결

```typescript
// src/schemas/staff.schema.ts
import '../validators/employee-id.validator.js';
import { schema, rule } from '@aomex/common';

export const staffSchema = schema({
  employeeId: rule.employeeId(), // [!code highlight]
  name: rule.string().trim().length({ min: 1 }),
});
```

```typescript
import { body } from '@aomex/web';
import { staffSchema } from '../schemas/staff.schema.js';

router.post('/staff', {
  mount: [body(staffSchema)],
  action: async (ctx) => {
    // ctx.body.employeeId 已是 string
    ctx.send({ id: ctx.body.employeeId });
  },
});
```

다시 시험: 유효한 사번은 action까지; `employeeId=abc`는 400이며 문구는 `deny`에서.

## 6단계(선택): 전용 체인 메서드

예: 소문자 `e` 허용. 내장 `trim` / `min`과 같이: `copy()` → `config` 수정 → `return`.

`Options`에 필드를 추가한 뒤 메서드 구현:

```typescript
export declare namespace EmployeeIdValidator {
  export interface Options<T> extends Validator.Options<T> {
    allowLowerE?: boolean;
  }
}

// 类里：
allowLowerE(is: boolean = true): this {
  const validator = this.copy();
  validator.config.allowLowerE = is;
  return validator;
}

protected validateValue(value: unknown, _key: string, label: string) {
  const pattern = this.config.allowLowerE ? /^[Ee]\d{6}$/ : /^E\d{6}$/;
  if (typeof value !== 'string' || !pattern.test(value)) {
    return ValidateResult.deny(`${label}必须是 E + 6 位数字的工号`);
  }
  return ValidateResult.accept(value);
}
```

사용: `rule.employeeId().allowLowerE()`.

`Rule.register`는 **무인자 팩토리**입니다. 「모드」는 체인이나 기본 `config`로, `rule.employeeId('v2')`는 기대하지 마세요(내장 `rule.uuid('v4')`는 Rule 클래스에 있고 `register`가 아님).

## 제품 문구를 `deny`에

`deny`에서 `import { i18n } from '../i18n/index.js'` 후 `i18n.t('errors.badEmployeeId')`. 프레임워크 `language`는 내장 검증 메시지, 제품 문구는 별도 — [제품 i18n](/ko/advanced/i18n).

## 한 파일에 모을 때 순서

namespace Options → class(`declare` 체인 + `validateValue` + `toDocument` + 전용 체인) → `declare module` → `Rule.register`.

같은 패턴:

- [rule.file()](/ko/validators/rules/file) (`@aomex/web`, `maxSize` 등)  
- [Mongoose](/ko/plugins/mongoose) `rule.mongoObjectId()`  

## 관련

- 일상: [검증기 빠른 시작](/ko/validators/)
- 공통 체인: [공통 체이닝](/ko/validators/chain)
- 스크립트: [수동 검증](/ko/validators/validate)
