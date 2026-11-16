---
outline: deep
---

# rule.ulid()

校验 **ULID**（26 字符、大致按时间有序）：orderId、同步游标 after。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const orderParams = schema({
  orderId: rule.ulid().required(), // [!code highlight]
});
// '01ARZ3NDEKTSV4RRFFQ69G5FAV' → 通过
```

- 通过后推断为 string。
- 无版本参数等工厂选项；无专属链，可选/默认走 [通用链式](../chain)。

通用链见 [通用链式](../chain)；[uuid](./uuid)、[int](./int)、[bigint](./bigint)。
