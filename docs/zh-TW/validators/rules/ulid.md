---
outline: deep
---

# rule.ulid()

校驗 **ULID**（26 字元、大致按時間有序）：orderId、同步游標 after。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const orderParams = schema({
  orderId: rule.ulid().required(), // [!code highlight]
});
// '01ARZ3NDEKTSV4RRFFQ69G5FAV' → 通过
```

- 通過後推斷為 string。
- 無版本引數等工廠選項；無專屬鏈，可選/預設走 [通用鏈式](../chain)。

通用鏈見 [通用鏈式](../chain)；[uuid](./uuid)、[int](./int)、[bigint](./bigint)。
