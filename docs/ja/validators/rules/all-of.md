---
outline: deep
---

# rule.allOf()

同一入力が配列内の **すべてのルールを同時に満たす** こと；チーム内のパスワード断片、API Key 形式の積み重ねに向く。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { rule, schema } from '@aomex/common';

const passwordBase = rule.string().length({ min: 8, max: 72 });
const passwordDigit = rule.string().match(/\d/);

export const registerSchema = schema({
  password: rule.allOf([passwordBase, passwordDigit]).required(), // [!code highlight]
});
// 'passw0rd!' → 通过；'short' → 失败
```

- 各ルール出力型の **交差** として推論される（同型 string の積み重ねが多い）。
- 専用チェーンなし。
- 単一フィールドで .length().match() と続ける方が読みやすいことが多い；allOf の強みは断片の **ファイル横断再利用**。

共通チェーンは [共通チェーン](../chain)；[string](./string)、[anyOf](./any-of)、[oneOf](./one-of)。
