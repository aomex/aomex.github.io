---
outline: deep
---

# rule.bigint()

校驗 **大整數**（bigint）：鏈上 wei、Snowflake ID、超過安全整數範圍的計數。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const ledgerSchema = schema({
  amountWei: rule.bigint().min(0n), // [!code highlight]
});
// body: { amountWei: '9007199254740992' } → 9007199254740992n
```

- 通過後推斷為 bigint。
- HTTP JSON 沒有原生 bigint，body 裡常見 **字串** 數字，非 strict 會嘗試轉換。
- 序列化響應前要 .toString() 或自定義 replacer。

別把 bigint 直接丟進 JSON.stringify——客戶端會炸。

### min(value: bigint, inclusive?: boolean)

**什麼時候用：** 最小充值、游標必須大於上一頁 ID（inclusive: false 為嚴格大於）。

```typescript
import { rule } from '@aomex/common';

rule.bigint().min(100n);
rule.bigint().min(100n, false);
```

### max(value: bigint, inclusive?: boolean)

**什麼時候用：** 單筆上限、配額封頂。

```typescript
import { rule } from '@aomex/common';

rule.bigint().min(0n).max(10_000_000_000_000_000_000n);
```

### strict(is?: boolean)

**什麼時候用：** 只收真正的 bigint，堵掉 '1e3' 等字串邊角。

```typescript
import { rule } from '@aomex/common';

rule.bigint().strict();'123' → 失败
```

通用鏈見 [通用鏈式](../chain)；[int](./int)、[decimal](./decimal)、[hash](./hash)。
