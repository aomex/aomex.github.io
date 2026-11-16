---
outline: deep
---

# rule.anyOf()

ルール配列の **少なくとも 1 つ** を満たせばよい；複数満たしても成功（ログイン名：メールまたは社員番号、検索 q：UUID または slug）。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { rule, schema } from '@aomex/common';

export const loginSchema = schema({
  account: rule.anyOf([ // [!code highlight]
    rule.email(),
    rule.string().match(/^@[a-z0-9_-]+$/i),
  ]).required(),
});
```

- 各ブランチ型の **ユニオン** として推論され、単一 string より広い。
- 専用チェーンなし；子ルールはそれぞれチェーン可能。
- 「ちょうど 1 つ」なら [oneOf](./one-of)——重なりが広すぎると oneOf は失敗し、anyOf は通常まだ通る。

共通チェーンは [共通チェーン](../chain)；[oneOf](./one-of)、[allOf](./all-of)、[email](./email)、[string](./string)。
