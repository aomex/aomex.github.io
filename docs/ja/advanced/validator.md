---
outline: deep
---

# カスタムバリデータ

社員番号、チェックディジット付き番号、内部列挙コード — 同じ形が body、query、schema、OpenAPI に何度も出ます。毎回 `rule.string().match(/^E\d{6}$/)` でも動きますが：

- エラーメッセージがバラバラで連携がずれる
- OpenAPI には汎用 string のままで形式が分からない
- ルール変更で正規表現を全体検索

本ページでは **`rule.employeeId()`** を一緒に作ります。検証・型・ドキュメントを一箇所で保守。一度きりのフィールドは [バリデータ一覧](/ja/validators/builtins) + [共通チェーン](/ja/validators/chain) で十分です。

## 完成イメージ

成功時フィールドは `string`；失敗は自動 400；ドキュメントに `pattern` と example。ルート上は最終的に：

```typescript
mount: [body({ employeeId: rule.employeeId() })];
```

## ステップ 1：クラスを作り、ランタイム検証だけ

`src/validators/employee-id.validator.ts` を新規作成。OpenAPI とチェーンメソッドは後回し — `accept` / `deny` できればよい。

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

`ValidateResult.accept(value)` は通過し、**ここで返した値**が後続に進みます（正規化も可）。`deny` の文字列は 400 エンベロープに入ります。

[手動検証](/ja/validators/validate) で HTTP なしに単体確認：

```typescript
import { validate } from '@aomex/common';
import { EmployeeIdValidator } from '@/validators/employee-id.validator';

await validate('E123456', new EmployeeIdValidator()); // 通过
// await validate('bad', new EmployeeIdValidator()); // 抛错
```

## ステップ 2：チェーンメソッドの型を宣言

基底の `optional` / `default` / `transform` などは `protected` 実装です。サブクラスで `declare public` し直さないと、チェーン後の型が基底に戻ったり補完が欠けます。組み込み `rule.string()` と同じ宣言を写してください（実装は基底にあります）：

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

`declare protected copy` が重要です。専用チェーン（次のステップ）は `this.copy()` クローンに依存し、戻り型は `EmployeeIdValidator` のままである必要があります。

## ステップ 3：`rule.xxx()` に登録

二段階、どちらも必須：

1. `declare module '@aomex/common'` で `Rule` を拡張 → エディタが `rule.employeeId()` を認識
2. `Rule.register('employeeId', EmployeeIdValidator)` → ランタイムにファクトリ

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
クラスだけで `register` なし：型だけたまたま合っても（手動 module 拡張時）、ランタイムは `rule.employeeId is not a function`。  
`register` だけで `declare module` なし：動くが補完なし、any になりがち。
:::

登録は **side-effect**：いかなる `rule.employeeId()` より前に実行。習慣として schema ファイル先頭で `import '@/validators/employee-id.validator'`、または `web.ts` / `cli.ts` エントリで一度 import。

## ステップ 4：OpenAPI 形状を補う

`toDocument()` をオーバーライドすると生成時に `pattern` / `example` が付きます。書かないとほぼ plain string です。

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

（プロジェクトで `OpenAPI` の export パスが型ヒントと違う場合はエディタのジャンプに従ってください。）

## ステップ 5：schema / ルートに載せる

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

改めて試す：合法な社員番号は action へ；`employeeId=abc` は 400 で、文案はあなたの `deny` 由来。

## ステップ 6（任意）：専用チェーンメソッド

例：小文字 `e` を許可。組み込み `trim` / `min` と同型：`copy()` → `config` 変更 → `return`。

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

使い方：`rule.employeeId().allowLowerE()`。

`Rule.register` は**無引数ファクトリ**；「モード」はチェーンかデフォルト config で。`rule.employeeId('v2')` は期待しない（組み込み `rule.uuid('v4')` は Rule クラス上のメソッドで、register 由来ではない）。

## エラー文案を製品言語パックに載せるとき

`deny` 内で `import { i18n } from '@/i18n'` して `i18n.t('errors.badEmployeeId')` 可。フレームワーク `language` は組み込み検証文案用で、業務パックとは別 — [アプリケーションの i18n](/ja/advanced/i18n)。

## ファイル全体の並び

上記を 1 ファイルにまとめる順序：`namespace Options` → class（declare チェーン + validateValue + toDocument + 専用チェーン）→ `declare module` → `Rule.register`。

同型の参考：

- [rule.file()](/ja/validators/rules/file)（`@aomex/web`、maxSize など）
- [Mongoose](/ja/plugins/mongoose) の `rule.mongoObjectId()`

## 関連

- 日常用法：[バリデータ：クイックスタート](/ja/validators/)
- 共通チェーン：[共通チェーン](/ja/validators/chain)
- スクリプト内検証：[手動検証](/ja/validators/validate)