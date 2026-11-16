---
outline: deep
---

# rule.number()

校驗 **有限數字（可含小數）**：評分、比例、經緯度分量、完成度等非金額小數。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const ratingSchema = schema({
  score: rule.number().min(0).max(5).precision(1), // [!code highlight]
});
// body: { score: 4.56 } → 先 toFixed(1) 再比范围，常为 4.6
```

- 通過後推斷為 number（不是 Decimal；金額用 [decimal](./decimal)）。
- query 裡 '3.5' 預設可轉成 3.5；strict() 後只收 number。
- precision(n) 會改變實際輸出的小數位，型別仍是 number。

### min(n, inclusive?: boolean)

**什麼時候用：** 不能為負的權重、進度、折扣係數下限。

```typescript
import { rule } from '@aomex/common';

rule.number().min(0);
rule.number().min(0, false); // 必须 > 0
```

### max(n, inclusive?: boolean)

**什麼時候用：** 五星封頂、比例不超過 1、經度範圍。

```typescript
import { rule } from '@aomex/common';

rule.number().min(0).max(5);
```

### precision(decimals: number)

**什麼時候用：** 滑塊一長串小數、介面約定「最多兩位」；用 toFixed 截斷後再參與 min/max。

```typescript
import { rule } from '@aomex/common';

rule.number().precision(2);
rule.number().min(0).max(100).precision(1);
```

precision 用 toFixed 截斷/舍入後再參與 min/max，和業務裡的銀行家舍入不一致時，在 transform 或業務層處理。

### strict(is?: boolean)

**什麼時候用：** JSON body 保證已是 number；query 保持預設寬鬆。

```typescript
import { rule } from '@aomex/common';

rule.number().strict();'1.5' → 失败
```

通用鏈見 [通用鏈式](../chain)；[int](./int)、[decimal](./decimal)、[bigint](./bigint)。
