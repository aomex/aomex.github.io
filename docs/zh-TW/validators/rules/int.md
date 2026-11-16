---
outline: deep
---

# rule.int()

校驗 **整數**：頁碼、數量、自增 ID、庫存件數（在安全整數範圍內）。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  page: rule.int().min(1).default(1), // [!code highlight]
  pageSize: rule.int().min(1).max(100).default(20),
});
// ?page=2 → page 为 2；省略 page → 1
```

- 通過後推斷為 number，且執行時是整數（Number.isInteger）。
- query 裡常進來是字串 '2'；預設非 strict 會轉成 2。
- default(n) 之後，客戶端沒傳欄位時型別上仍有 number。

超過 Number.MAX_SAFE_INTEGER 用 [bigint](./bigint)；訂單金額、費率別用 int 或裸 [number](./number) 扛小數，見 [decimal](./decimal)。

### min(n, inclusive?: boolean)

**什麼時候用：** 頁碼從 1 起、下單數量至少 1；inclusive: false 表示必須 **大於** n。

```typescript
import { rule } from '@aomex/common';

rule.int().min(1).default(1);
rule.int().min(0, false); // 必须 > 0
```

### max(n, inclusive?: boolean)

**什麼時候用：** pageSize 封頂、批次 ID 上限。

```typescript
import { rule } from '@aomex/common';

rule.int().min(1).max(100).default(20);
```

與 [`number.min` / `number.max`](./number) 語義相同，本規則另外要求整數。

### strict(is?: boolean)

**什麼時候用：** 純 JSON body 已是 number；**query 一般別開**，否則 '1' 會掛。

```typescript
import { rule } from '@aomex/common';

rule.int().strict();'18' → 失败；18 → 通过；18.5 → 失败
```

::: warning
分頁 query 上開 strict() 是常見自爆點——字串頁碼進不來。
:::

通用鏈見 [通用鏈式](../chain)；[number](./number)（小數）、[bigint](./bigint)（超大整數）、[decimal](./decimal)（金額）。
