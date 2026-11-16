---
outline: deep
---

# rule.email()

**メール形式の文字列**を検証する：登録アカウント、通知宛先、招待メール（形式のみ；存在確認はしない）。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { rule, schema } from '@aomex/common';

export const registerSchema = schema({
  email: rule.email().required(), // [!code highlight]
});
// { email: 'ada@example.com' } → 通过；'ada@' → 失败
```

- 成功後の型推論は string；OpenAPI 側はしばしば email 形式になる。
- trim / 長さの専用チェーンはない——必要なら [transform](../chain) または業務側で処理。

「メール必須」のフィールドは本ファクトリを使い、string().match で代用しない。ログイン名「メールまたは社員番号」は [anyOf](./any-of)。

### match(pattern: RegExp)

**いつ使うか：** 企業登録で社内ドメインのみ、クローズドベータのサフィックスホワイトリスト（メール形式通過後に正規表現を重ねる）。

```typescript
import { rule } from '@aomex/common';

rule.email().match(/@acme\.com$/i);
// 'ada@acme.com' → 通过；'ada@gmail.com' → 格式过、match 失败
```

match は形式制約の重ねがけのみ；「確認コード送信済み」は代替できない——配信成否は業務層。

共通チェーンは [共通チェーン](../chain)；[string](./string)、[url](./url)、[anyOf](./any-of)。
