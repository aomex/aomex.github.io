---
outline: deep
---

# カスタムバリデータ

社員番号、チェックディジット付き伝票、内部列挙コード——同じ形が body、query、schema、OpenAPI に何度も出る。毎回 `rule.string().match(/^E\d{6}$/)` でも動くが：

- エラーメッセージがバラバラで結合テストがずれる  
- OpenAPI には汎用 string しか残らず、形式が分からない  
- ルール変更で正規表現を全域検索する羽目になる  

このページでは **`rule.employeeId()`** まで一緒に作る：検証・型・ドキュメントを一箇所で保守。一度きりのフィールドは [バリデータ一覧](/ja/validators/builtins) + [共通チェーン](/ja/validators/chain) で十分。

## 完成形

成功時フィールドは `string`；失敗は自動 400；ドキュメントに `pattern` と例。ルートでは最終的に：

```typescript
mount: [body({ employeeId: rule.employeeId() })];
```
## ステップ1：クラスを作り、実行時検証だけ

`src/validators/employee-id.validator.ts` を新規作成。OpenAPI やチェーンメソッドは後回し——`accept` / `deny` できればよい。

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
`ValidateResult.accept(value)` は通過を表し、**ここで返した値**が後続に入る（正規化も可）。`deny` の文字列は 400 エンベロープに入る。

HTTP を起こさず [手動検証](/ja/validators/validate) で単体テスト：

```typescript
import { validate } from '@aomex/common';
import { EmployeeIdValidator } from './employee-id.validator.js';

await validate('E123456', new EmployeeIdValidator()); // 通过
// await validate('bad', new EmployeeIdValidator()); // 抛错
```
## ステップ2：チェーンメソッドの型を宣言

基底の `optional` / `default` / `transform` などは `protected` 実装。子クラスで `declare public` し直さないと、チェーン後の型が基底に落ちたり補全が消える。組み込み `rule.string()` の宣言を写す（実装は基底にある）：

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
`declare protected copy` が重要：専用チェーン（次のステップ）は `this.copy()` で複製し、戻り型は `EmployeeIdValidator` のままにする。

## ステップ3：`rule.xxx()` に登録

両方欠かせない：

1. `declare module '@aomex/common'` で `Rule` インタフェース拡張 → エディタが `rule.employeeId()` を認識  
2. `Rule.register('employeeId', EmployeeIdValidator)` → 実行時にこのファクトリが存在  

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
クラスだけ書いて `register` しない：型はたまたま合っても（手動で module 拡張した場合）、実行時は `rule.employeeId is not a function`。  
`register` だけで `declare module` しない：動くが補全がなく any になりやすい。
:::

登録は **副作用**：いかなる `rule.employeeId()` より前に実行。習慣は schema ファイル先頭で `import '../validators/employee-id.validator.js'`、または `web.ts` / `cli.ts` 入口で一度 import。

## ステップ4：OpenAPI 形状を足す

`toDocument()` をオーバーライド。書かないとドキュメントはほぼ plain string。

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
（プロジェクトで `OpenAPI` の `@aomex/common` からの export パスが型ヒントと違う場合は、エディタの定義ジャンプに従う。）

## ステップ5：schema / ルートにマウント

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
再度試す：合法な社員番号は action へ；`employeeId=abc` は 400 で、文言は自分の `deny` 由来のはず。

## ステップ6（任意）：専用チェーンメソッド

例：小文字 `e` を許す。組み込み `trim` / `min` と同じ：`copy()` → `config` 変更 → `return`。

まず `Options` にフィールドを足し、メソッドを実装：

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

`Rule.register` が載せるのは**無引数ファクトリ**。「モード」が要るときはチェーンかデフォルト config。`rule.employeeId('v2')` は期待しない（組み込み `rule.uuid('v4')` は Rule クラス直下で、register 由来ではない）。

## エラー文言を製品言語パックへ

`deny` 内で `import { i18n } from '../i18n/index.js'` して `i18n.t('errors.badEmployeeId')` 可。フレームワーク `language` は組み込み検証文言、[ビジネス i18n](/ja/advanced/i18n) は別系統。

## ファイル全体の参照

上記を1ファイルにまとめる順序の目安：namespace Options → class（declare チェーン + validateValue + toDocument + 専用チェーン）→ `declare module` → `Rule.register`。

同じ型の参考：

- [rule.file()](/ja/validators/rules/file)（`@aomex/web`、maxSize など）  
- [Mongoose](/ja/plugins/mongoose) の `rule.mongoObjectId()`  

## 関連

- 日常使用：[バリデータ：クイックスタート](/ja/validators/)
- 共通チェーン：[共通チェーン](/ja/validators/chain)
- スクリプト内検証：[手動検証](/ja/validators/validate)
