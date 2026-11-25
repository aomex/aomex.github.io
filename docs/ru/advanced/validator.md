---
outline: deep
---

# Пользовательский валидатор

Табельный номер, номер с контрольной цифрой, внутренний код перечисления — одна и та же форма многократно в body, query, schema и OpenAPI. Каждый раз `rule.string().match(/^E\d{6}$/)` сработает, но:

- тексты ошибок разъезжаются при интеграции;
- в OpenAPI остаётся generic string без формата;
- смена правила — глобальный поиск по regex.

На этой странице вместе доводим до **`rule.employeeId()`**: проверка, типы и документация в одном месте. Разовые поля — [список валидаторов](/ru/validators/builtins) и [общая цепочка](/ru/validators/chain).

## Как должно выглядеть в конце

При успехе поле — `string`; при ошибке автоматический 400; в документе `pattern` и example. На маршруте в итоге:

```typescript
mount: [body({ employeeId: rule.employeeId() })];
```

## Шаг 1: класс, только рантайм-проверка

Создайте `src/validators/employee-id.validator.ts`. OpenAPI и цепочки — потом; достаточно `accept` / `deny`.

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

`ValidateResult.accept(value)` — прохождение; **именно это значение** идёт дальше (можно нормализовать). Строка в `deny` попадает в envelope 400.

Проверьте без HTTP через [ручную валидацию](/ru/validators/validate):

```typescript
import { validate } from '@aomex/common';
import { EmployeeIdValidator } from '@/validators/employee-id.validator';

await validate('E123456', new EmployeeIdValidator()); // 通过
// await validate('bad', new EmployeeIdValidator()); // 抛错
```

## Шаг 2: объявить типы цепочных методов

`optional` / `default` / `transform` на базовом классе — `protected` реализации. Без `declare public` в наследнике тип после цепочки откатывается к базе или теряет дополнения. Скопируйте объявления как у встроенного `rule.string()` (реализация уже в базе):

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

`declare protected copy` критичен: своя цепочка (следующий шаг) клонирует через `this.copy()`, возвращаемый тип должен остаться `EmployeeIdValidator`.

## Шаг 3: зарегистрировать в `rule.xxx()`

Два шага, оба обязательны:

1. `declare module '@aomex/common'` расширяет `Rule` → редактор знает `rule.employeeId()`
2. `Rule.register('employeeId', EmployeeIdValidator)` → фабрика в рантайме

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
Только класс без `register`: типы могут совпасть (если руками расширяли module), в рантайме `rule.employeeId is not a function`.  
Только `register` без `declare module`: работает, но без дополнения, легко уйти в any.
:::

Регистрация — **side-effect**: выполнить до любого `rule.employeeId()`. Обычно `import '@/validators/employee-id.validator'` вверху schema-файла или один раз в entry `web.ts` / `cli.ts`.

## Шаг 4: форма OpenAPI

Переопределите `toDocument()` — при генерации появятся `pattern` / `example`. Иначе почти plain string.

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

(Если путь экспорта `OpenAPI` в проекте не совпадает с подсказкой — следуйте переходу из редактора.)

## Шаг 5: schema / маршрут

```typescript
// src/schemas/staff.schema.ts
import '@/validators/employee-id.validator';
import { schema, rule } from '@aomex/common';

export const staffSchema = schema({
  employeeId: rule.employeeId(), // [!code highlight]
  name: rule.string().trim().length({ min: 1 }),
});
```

```typescript
import { body } from '@aomex/web';
import { staffSchema } from '@/schemas/staff.schema';

router.post('/staff', {
  mount: [body(staffSchema)],
  action: async (ctx) => {
    // ctx.body.employeeId 已是 string
    ctx.send({ id: ctx.body.employeeId });
  },
});
```

Проверка: валидный номер доходит до action; `employeeId=abc` → 400, текст из вашего `deny`.

## Шаг 6 (опционально): свой метод цепочки

Например разрешить строчную `e`. Как у встроенных `trim` / `min`: `copy()` → правка `config` → `return`.

Сначала поле в `Options`, затем метод:

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

Использование: `rule.employeeId().allowLowerE()`.

`Rule.register` — **фабрика без аргументов**; «режимы» — через цепочку или default config. Не ждите `rule.employeeId('v2')` (встроенный `rule.uuid('v4')` — метод на классе Rule, не из register).

## Продуктовые строки в `deny`

В `deny` можно `import { i18n } from '@/i18n'` и `i18n.t('errors.badEmployeeId')`. `language` фреймворка — для встроенных сообщений валидации; бизнес-пакет отдельно — см. [i18n приложения](/ru/advanced/i18n).

## Порядок в одном файле

Соберите шаги так: namespace Options → class (declare цепочки + validateValue + toDocument + своя цепочка) → `declare module` → `Rule.register`.

Аналоги:

- [rule.file()](/ru/validators/rules/file) (`@aomex/web`, maxSize и т.д.)
- `rule.mongoObjectId()` в [Mongoose](/ru/plugins/mongoose)

## См. также

- Повседневное использование: [валидаторы: быстрый старт](/ru/validators/)
- Общая цепочка: [общая цепочка](/ru/validators/chain)
- В скриптах: [ручная валидация](/ru/validators/validate)