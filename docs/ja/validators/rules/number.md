---
outline: deep
---

# rule.number()

**有限数（小数可）**を検証する：評価、比率、緯度経度成分、完了度など、金額以外の小数。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { rule, schema } from '@aomex/common';

export const ratingSchema = schema({
  score: rule.number().min(0).max(5).precision(1), // [!code highlight]
});
// body: { score: 4.56 } → 先 toFixed(1) 再比范围，常为 4.6
```

- 成功後の型推論は number（Decimal ではない；金額は [decimal](./decimal)）。
- query の '3.5' はデフォルトで 3.5 に；strict() 後は number のみ。
- precision(n) は実際の小数桁を変えるが、型は number のまま。

### min(n, inclusive?: boolean)

**いつ使うか：** 負になれない重み、進捗、割引係数の下限。

```typescript
import { rule } from '@aomex/common';

rule.number().min(0);
rule.number().min(0, false); // 必须 > 0
```

### max(n, inclusive?: boolean)

**いつ使うか：** 5 段階上限、比率 1 以下、経度レンジ。

```typescript
import { rule } from '@aomex/common';

rule.number().min(0).max(5);
```

### precision(decimals: number)

**いつ使うか：** スライダーの長い小数、API で「最大 2 桁」；toFixed で切ってから min/max。

```typescript
import { rule } from '@aomex/common';

rule.number().precision(2);
rule.number().min(0).max(100).precision(1);
```

precision は toFixed で切り捨て/丸めたあと min/max に入る。銀行家丸めと業務が食い違うときは transform か業務層で処理。

### strict(is?: boolean)

**いつ使うか：** JSON body がすでに number；query はデフォルトの寛容のまま。

```typescript
import { rule } from '@aomex/common';

rule.number().strict();'1.5' → 失败
```

共通チェーンは [共通チェーン](../chain)；[int](./int)、[decimal](./decimal)、[bigint](./bigint)。
