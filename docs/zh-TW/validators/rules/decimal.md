---
outline: deep
---

# rule.decimal()

用 **decimal.js** 校驗金額、匯率、稅率——避免 0.1 + 0.2 這類浮點誤差。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const paySchema = schema({
  amount: rule.decimal().min('0.01').max('50000'), // [!code highlight]
});
// body: { amount: '19.99' } → Decimal 实例
```

- 通過後執行時多為 Decimal（來自 decimal.js），不是 number。
- default('0') 會把字串/數字包成 Decimal 再當預設值。
- 響應 JSON 前一般要 .toString()，別把帶方法的物件直接 JSON.stringify。

OpenAPI / 前端型別常常是 string，和執行時 Decimal 要在業務邊界轉換。

### min(value, inclusive?: boolean)

**什麼時候用：** 最小支付額、餘額非負、value 可為 string / number / Decimal。

```typescript
import { rule } from '@aomex/common';

rule.decimal().min('0.01');
rule.decimal().min(0, false);
```

### max(value, inclusive?: boolean)

**什麼時候用：** 單筆封頂、折扣不超過 1。

```typescript
import { rule } from '@aomex/common';

rule.decimal().min('0.01').max('50000');
```

### default(value)

**什麼時候用：** 新建賬戶餘額從 0、可選運費預設 0（會包成 Decimal）。

```typescript
import { rule } from '@aomex/common';

rule.decimal().default('0');
```

### strict(is?: boolean)

**什麼時候用：** 內部已傳 Decimal 實例；對外 HTTP 一般保持預設收字串。

```typescript
import { rule } from '@aomex/common';

rule.decimal().strict();'1.5' → 失败
```

校驗通過後加減仍應在 Decimal 上算，展示層和儲存層別混用裸 number。

通用鏈見 [通用鏈式](../chain)；[number](./number)、[int](./int)、[bigint](./bigint)。
