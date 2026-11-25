---
outline: deep
---

# 自定義驗證器

工號、帶校驗位的單號、內部列舉碼——同一種形態會在 body、query、schema、OpenAPI 裡反覆出現。每次寫 `rule.string().match(/^E\d{6}$/)` 能跑，但：

- 報錯文案各寫各的，聯調對不齊  
- OpenAPI 裡只剩泛型 string，看不出格式  
- 改規則要全域性搜正則  

這一頁帶著你做成 **`rule.employeeId()`**：校驗、型別、文件同一處維護。一次性欄位仍用 [驗證器列表](/zh-TW/validators/builtins) + [通用鏈式](/zh-TW/validators/chain) 即可。

## 目標長什麼樣

成功時欄位是 `string`；失敗自動 400；文件裡帶 `pattern` 和示例。路由上最終是：

```typescript
mount: [body({ employeeId: rule.employeeId() })];
```

## 第一步：建類，只做執行時校驗

新建 `src/validators/employee-id.validator.ts`。先別管 OpenAPI 和鏈式方法——能 `accept` / `deny` 就行。

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

`ValidateResult.accept(value)` 表示通過，並且**以這裡返回的值**進入後續（可做規範化）；`deny` 的字串會進 400 信封。

用 [手動校驗](/zh-TW/validators/validate) 先單測一把，不必起 HTTP：

```typescript
import { validate } from '@aomex/common';
import { EmployeeIdValidator } from '@/validators/employee-id.validator';

await validate('E123456', new EmployeeIdValidator()); // 通过
// await validate('bad', new EmployeeIdValidator()); // 抛错
```

## 第二步：宣告鏈式方法型別

基類上的 `optional` / `default` / `transform` 等是 `protected` 實現。你的子類若不 `declare public` 一遍，鏈式呼叫後型別會掉回基類或補全缺失。照著內建 `rule.string()` 的寫法抄宣告即可（實現已在基類）：

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

`declare protected copy` 很關鍵：專屬鏈（下一步）要靠 `this.copy()` 克隆，返回型別必須仍是 `EmployeeIdValidator`。

## 第三步：註冊到 `rule.xxx()`

兩步缺一不可：

1. `declare module '@aomex/common'` 增強 `Rule` 介面 → 編輯器才認 `rule.employeeId()`  
2. `Rule.register('employeeId', EmployeeIdValidator)` → 執行時才有這個工廠  

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
只寫了類、沒 `register`：型別可能僥倖對了（若你手動增強了模組），執行時 `rule.employeeId is not a function`。  
只 `register`、沒 `declare module`：能跑，但補全沒有、容易寫成 any。
:::

註冊是 **side-effect**：在任何 `rule.employeeId()` 之前就要執行。習慣做法是在 schema 檔案頂部 `import '@/validators/employee-id.validator'`，或在 `web.ts` / `cli.ts` 入口統一 import 一次。

## 第四步：補 OpenAPI 形狀

覆蓋 `toDocument()`，生成文件時才有 `pattern` / `example`。不寫的話，文件裡幾乎就是普通 string。

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

（若你專案裡 `OpenAPI` 從 `@aomex/common` 匯出路徑與型別提示不一致，以編輯器跳轉為準。）

## 第五步：掛到 schema / 路由

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

這時再試：合法工號進 action；`employeeId=abc` 應 400，且文案來自你的 `deny`。

## 第六步（可選）：專屬鏈式方法

例如允許小寫 `e`。模式與內建 `trim` / `min` 相同：`copy()` → 改 `config` → `return`。

先在 `Options` 里加欄位，再實現方法：

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

`Rule.register` 掛的是**無參工廠**；需要「模式」時用鏈式或預設 config，別指望 `rule.employeeId('v2')`（內建 `rule.uuid('v4')` 是寫在 Rule 類上的，不是 register 出來的）。

## 報錯文案要走產品語言包時

`deny` 裡可以 `import { i18n } from '@/i18n'` 再 `i18n.t('errors.badEmployeeId')`。框架 `language` 管的是內建校驗文案，和業務包是兩套——見 [業務國際化](/zh-TW/advanced/i18n)。

## 完整檔案對照

把上面步驟收在一個檔案裡時，順序建議是：namespace Options → class（declare 鏈 + validateValue + toDocument + 專屬鏈）→ `declare module` → `Rule.register`。

同套路可參考：

- [rule.file()](/zh-TW/validators/rules/file)（`@aomex/web`，帶 maxSize 等）  
- [Mongoose](/zh-TW/plugins/mongoose) 的 `rule.mongoObjectId()`  

## 相關

- 日常用法：[驗證器：快速上手](/zh-TW/validators/)
- 通用鏈：[通用鏈式](/zh-TW/validators/chain)
- 腳本里驗：[手動校驗](/zh-TW/validators/validate)
