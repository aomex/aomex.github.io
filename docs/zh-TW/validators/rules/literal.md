---
outline: deep
---

# rule.literal()

要求入參 **精確等於** 某個字面量：Webhook event、判別聯合的 type、固定 action: 'ping'。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const pingSchema = schema({
  action: rule.literal('ping'), // [!code highlight]
});
// { action: 'ping' } → 通过；'pong' → 失败；'1' 与 1 不相等
```

- 推斷收窄為具體字面量型別（如 'ping'）。
- 不做型別轉換——'1' 與 1 是不同分支。
- 無專屬鏈；optional / default 見 [通用鏈式](../chain)。

通用鏈見 [通用鏈式](../chain)；[enum](./enum)、[oneOf](./one-of)、[anyOf](./any-of)。
