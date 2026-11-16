---
outline: deep
---

# Собственный валидатор

Номер задания, нечетное число с контрольной цифрой, внутренний код перечисления — одна и та же форма будет неоднократно появляться в теле, запросе, схеме и OpenAPI. пишите каждый раз `rule.string().match(/^E\d{6}$/)` Можно запустить, но:

- Каждая копия отчета об ошибках пишется по-своему, и совместная отладка непоследовательна.
- В OpenAPI осталась только общая строка, формат не виден.
- Чтобы изменить правила, выполните поиск обычных правил по всему миру.

Эта страница поможет вам сделать это **` rule.employeeId()`**: Проверка, тип и документы хранятся в одном месте. Для одноразовых полей по-прежнему используйте [Встроенные валидаторы](/ru/validators/builtins) + [Общая цепочка](/ru/validators/chain).

## Как выглядит цель?

В случае успеха поле ` string `; Автоматический 400 при отказе; Включено в документ ` pattern ` и примеры. Конечный маршрут:

```typescript
mount: [body({ employeeId: rule.employeeId() })];
```

## Первый шаг: создайте класс и выполняйте только проверку во время выполнения.

Новый ` src/validators/employee-id.validator.ts`. Забудьте пока об OpenAPI и связанных методах — вы можете ` accept`/` deny `Вот и все.

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

` ValidateResult.accept(value)` Указывает на прохождение, и **возвращаемое здесь значение** будет использоваться для ввода последующих действий (может быть нормализовано);` deny ` Нитка уйдет в 400 конвертов.

Используйте [Ручная проверка](/ru/validators/validate), чтобы протестировать его самостоятельно, не запуская HTTP:

```typescript
import { validate } from '@aomex/common';
import { EmployeeIdValidator } from './employee-id.validator.js';

await validate('E123456', new EmployeeIdValidator()); // 通过
// await validate('bad', new EmployeeIdValidator()); // 抛错
```

## Шаг 2. Объявите тип метода цепочки

в базовом классе ` optional`/` default `/` transform `Ждать` protected `выполнить. Если ваш подкласс не` declare public `И снова тип вернется к базовому классу или дополнит недостающие элементы после цепного вызова. По встроенному` rule.string()`Просто скопируйте оператор (реализация уже есть в базовом классе):

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

` declare protected copy `Очень критично: эксклюзивная цепочка (следующий шаг) зависит от` this.copy()`Клонировать, тип возвращаемого значения по-прежнему должен быть ` EmployeeIdValidator`.

## Шаг 3: Зарегистрируйтесь в ` rule.xxx()`

Два шага обязательны:

1. ` declare module '@aomex/common'`Усиливать ` Rule`Интерфейс → Редактор распознает только ` rule.employeeId()`  
2. ` Rule.register('employeeId', EmployeeIdValidator)`→ Эта фабрика существует только при запуске  

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
Только класс написан, нет ` register`: К счастью, тип может быть правильным (если вы улучшили модуль вручную) во время выполнения. ` rule.employeeId is not a function`.
Только ` register`,без ` declare module`: Запустить можно, но завершение недоступно. Легко написать как угодно.
:::

Регистрация является **побочным эффектом**: на любом ` rule.employeeId()`Это должно быть реализовано заранее. Обычной практикой является размещение его в верхней части файла схемы. ` import '../validators/employee-id.validator.js'`или в ` web.ts`/` cli.ts `Вход импортируется один раз.

## Шаг 4. Заполните форму OpenAPI.

крышка` toDocument()`, доступно только при создании документов ` pattern`/` example `. Если этого не написать, документ будет почти обычной строкой.

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

(Если в вашем проекте ` OpenAPI`от `@aomex/common` Если путь экспорта не соответствует подсказке типа, переход к редактору имеет преимущественную силу. )

## Шаг 5: Подключитесь к схеме/маршрутизации

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

Попробуйте сейчас еще раз: введите действие с легальным рабочим номером;` employeeId=abc `Должно быть 400, и копия исходит от вашего` deny `.

## Шаг 6 (необязательно): метод эксклюзивной цепочки

Например, допускается использование нижнего регистра.` e `. Режимы и встроенные модули` trim `/` min `такой же:` copy()`→ Изменить ` config`→` return `.

первый` Options `Рижские поля, а затем реализовать метод:

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

использование:` rule.employeeId().allowLowerE()`.

` Rule.register ` Висит **фабрика без параметров**; когда вам нужен «режим», используйте цепочку или конфигурацию по умолчанию, не ждите этого ` rule.employeeId('v2')`(встроенный ` rule.uuid('v4')` Это написано в классе Rule, не зарегистрировано).

## При ошибке копирайтинга необходимо использовать языковой пакет продукта

` deny ` Ничего страшного ` import { i18n } from '../i18n/index.js'` Снова ` i18n.t('errors.badEmployeeId')`. рамка ` language ` Он управляет встроенной проверочной копией, которая представляет собой два набора бизнес-пакетов — см. [Продукт i18n](/ru/advanced/i18n).

## Полное сравнение файлов

При сборе вышеуказанных шагов в файл рекомендуемая последовательность: Параметры пространства имен → класс (цепочка объявления + validateValue + toDocument + эксклюзивная цепочка) →` declare module `→` Rule.register `.

Вы можете обратиться к той же процедуре:

- [rule.file()](/ru/validators/rules/file)(`@aomex/web `, с maxSize и т. д.)
- [Mongoose](/ru/plugins/mongoose)` rule.mongoObjectId()`  

## Связанный

-Ежедневное использование: [Валидаторы: быстрый старт](/ru/validators/)
- Универсальная цепь: [Общая цепочка](/ru/validators/chain)
- Проверка сценария: [Ручная проверка](/ru/validators/validate)