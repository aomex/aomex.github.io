---
outline: deep
---

# 自定义验证器

工号、带校验位的单号、内部枚举码——同一种形态会在 body、query、schema、OpenAPI 里反复出现。每次写 `rule.string().match(/^E\d{6}$/)` 能跑，但：

- 报错文案各写各的，联调对不齐  
- OpenAPI 里只剩泛型 string，看不出格式  
- 改规则要全局搜正则  

这一页带着你做成 **`rule.employeeId()`**：校验、类型、文档同一处维护。一次性字段仍用 [验证器列表](/zh/validators/builtins) + [通用链式](/zh/validators/chain) 即可。

## 目标长什么样

成功时字段是 `string`；失败自动 400；文档里带 `pattern` 和示例。路由上最终是：

```typescript
mount: [body({ employeeId: rule.employeeId() })];
```

## 第一步：建类，只做运行时校验

新建 `src/validators/employee-id.validator.ts`。先别管 OpenAPI 和链式方法——能 `accept` / `deny` 就行。

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

`ValidateResult.accept(value)` 表示通过，并且**以这里返回的值**进入后续（可做规范化）；`deny` 的字符串会进 400 信封。

用 [手动校验](/zh/validators/validate) 先单测一把，不必起 HTTP：

```typescript
import { validate } from '@aomex/common';
import { EmployeeIdValidator } from '@/validators/employee-id.validator';

await validate('E123456', new EmployeeIdValidator()); // 通过
// await validate('bad', new EmployeeIdValidator()); // 抛错
```

## 第二步：声明链式方法类型

基类上的 `optional` / `default` / `transform` 等是 `protected` 实现。你的子类若不 `declare public` 一遍，链式调用后类型会掉回基类或补全缺失。照着内置 `rule.string()` 的写法抄声明即可（实现已在基类）：

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

`declare protected copy` 很关键：专属链（下一步）要靠 `this.copy()` 克隆，返回类型必须仍是 `EmployeeIdValidator`。

## 第三步：注册到 `rule.xxx()`

两步缺一不可：

1. `declare module '@aomex/common'` 增强 `Rule` 接口 → 编辑器才认 `rule.employeeId()`  
2. `Rule.register('employeeId', EmployeeIdValidator)` → 运行时才有这个工厂  

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
只写了类、没 `register`：类型可能侥幸对了（若你手动增强了模块），运行时 `rule.employeeId is not a function`。  
只 `register`、没 `declare module`：能跑，但补全没有、容易写成 any。
:::

注册是 **side-effect**：在任何 `rule.employeeId()` 之前就要执行。习惯做法是在 schema 文件顶部 `import '@/validators/employee-id.validator'`，或在 `web.ts` / `cli.ts` 入口统一 import 一次。

## 第四步：补 OpenAPI 形状

覆盖 `toDocument()`，生成文档时才有 `pattern` / `example`。不写的话，文档里几乎就是普通 string。

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

（若你项目里 `OpenAPI` 从 `@aomex/common` 导出路径与类型提示不一致，以编辑器跳转为准。）

## 第五步：挂到 schema / 路由

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

这时再试：合法工号进 action；`employeeId=abc` 应 400，且文案来自你的 `deny`。

## 第六步（可选）：专属链式方法

例如允许小写 `e`。模式与内置 `trim` / `min` 相同：`copy()` → 改 `config` → `return`。

先在 `Options` 里加字段，再实现方法：

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

用法：`rule.employeeId().allowLowerE()`。

`Rule.register` 挂的是**无参工厂**；需要「模式」时用链式或默认 config，别指望 `rule.employeeId('v2')`（内置 `rule.uuid('v4')` 是写在 Rule 类上的，不是 register 出来的）。

## 报错文案要走产品语言包时

`deny` 里可以 `import { i18n } from '@/i18n'` 再 `i18n.t('errors.badEmployeeId')`。框架 `language` 管的是内置校验文案，和业务包是两套——见 [业务国际化](/zh/advanced/i18n)。

## 完整文件对照

把上面步骤收在一个文件里时，顺序建议是：namespace Options → class（declare 链 + validateValue + toDocument + 专属链）→ `declare module` → `Rule.register`。

同套路可参考：

- [rule.file()](/zh/validators/rules/file)（`@aomex/web`，带 maxSize 等）  
- [Mongoose](/zh/plugins/mongoose) 的 `rule.mongoObjectId()`  

## 相关

- 日常用法：[验证器：快速上手](/zh/validators/)
- 通用链：[通用链式](/zh/validators/chain)
- 脚本里验：[手动校验](/zh/validators/validate)
