---
outline: deep
---

# Custom validators

Employee IDs, check-digit serials, internal enum codes—the same shape shows up in body, query, schema, and OpenAPI. You can write `rule.string().match(/^E\d{6}$/)` every time, but then:

- Error copy diverges across the API  
- OpenAPI shows a plain string with no format  
- Rule changes mean searching the repo for regexes  

This page walks you through **`rule.employeeId()`**: validation, types, and docs in one place. One-off fields still belong on [Built-in validators](/en/validators/builtins) and [Common chaining](/en/validators/chain).

## What success looks like

On success the field is a `string`; failure is 400 automatically; docs carry `pattern` and an example. On a route you end up with:

```typescript
mount: [body({ employeeId: rule.employeeId() })];
```

## Step 1: Create the class—runtime only

Add `src/validators/employee-id.validator.ts`. Skip OpenAPI and chain methods for now—`accept` / `deny` is enough.

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

`ValidateResult.accept(value)` means pass, and **the value you return** flows onward (you can normalize); the string in `deny` goes into the 400 envelope.

Smoke-test with [manual validation](/en/validators/validate)—no HTTP required:

```typescript
import { validate } from '@aomex/common';
import { EmployeeIdValidator } from './employee-id.validator.js';

await validate('E123456', new EmployeeIdValidator()); // pass
// await validate('bad', new EmployeeIdValidator()); // throws
```

## Step 2: Declare chain method types

`optional`, `default`, `transform`, and friends on the base class are `protected` implementations. Without `declare public` on your subclass, chained calls fall back to the base type or lose completion. Mirror built-in `rule.string()` declarations (implementation stays on the base):

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

`declare protected copy` matters: custom chains (next step) clone via `this.copy()`; the return type must stay `EmployeeIdValidator`.

## Step 3: Register on `rule.xxx()`

Both steps are required:

1. `declare module '@aomex/common'` augments `Rule` → editor knows `rule.employeeId()`  
2. `Rule.register('employeeId', EmployeeIdValidator)` → runtime factory exists  

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
Class only, no `register`: types might look fine (if you augmented manually) but runtime throws `rule.employeeId is not a function`.  
`register` only, no `declare module`: it runs but you lose completion and drift toward `any`.
:::

Registration is a **side effect**: it must run before any `rule.employeeId()`. Common pattern: `import '../validators/employee-id.validator.js'` at the top of a schema file, or one import in `web.ts` / `cli.ts`.

## Step 4: OpenAPI shape

Override `toDocument()` so generation emits `pattern` / `example`. Without it, docs are basically a plain string.

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

(If `OpenAPI` import path from `@aomex/common` disagrees with your project, follow “go to definition” in the editor.)

## Step 5: Wire schema / routes

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
    // ctx.body.employeeId is already string
    ctx.send({ id: ctx.body.employeeId });
  },
});
```

Try again: valid IDs reach the action; `employeeId=abc` should 400 with your `deny` message.

## Step 6 (optional): Custom chain methods

Example: allow lowercase `e`. Same pattern as built-in `trim` / `min`: `copy()` → tweak `config` → `return`.

Add fields on `Options`, then implement:

```typescript
export declare namespace EmployeeIdValidator {
  export interface Options<T> extends Validator.Options<T> {
    allowLowerE?: boolean;
  }
}

// in class:
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

Usage: `rule.employeeId().allowLowerE()`.

`Rule.register` exposes a **zero-arg factory**; for “modes” use chains or default `config`, not `rule.employeeId('v2')` (built-in `rule.uuid('v4')` lives on the Rule class, not via `register`).

## Product copy in `deny`

You can `import { i18n } from '../i18n/index.js'` in `deny` and call `i18n.t('errors.badEmployeeId')`. Framework `language` covers built-in validation messages; product copy is separate—see [Product i18n](/en/advanced/i18n).

## Full file layout

When everything lives in one file, order: namespace `Options` → class (`declare` chains + `validateValue` + `toDocument` + custom chains) → `declare module` → `Rule.register`.

Same pattern elsewhere:

- [rule.file()](/en/validators/rules/file) (`@aomex/web`, with `maxSize`, etc.)  
- [Mongoose](/en/plugins/mongoose) `rule.mongoObjectId()`  

## Related

- Day-to-day: [Validators: quick start](/en/validators/)
- Common chains: [Common chaining](/en/validators/chain)
- Scripts: [Manual validation](/en/validators/validate)