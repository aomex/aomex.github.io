---
outline: deep
---

# rule.record()

表達 **`Record<string, V>`**：功能開關表、多語言文案、標籤→權重——鍵名不固定、值型別統一。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const flagsSchema = schema({
  features: rule.record(rule.boolean()), // [!code highlight]
});
// { darkMode: true, beta: false } → 通过
```

- 等價 `rule.object().additional({ value })`，推斷為「任意字串鍵 + 固定值型別」。
- 值規則上的 min / optional 等照常掛在 **value** 那條 rule 上。
- 無本規則專屬鏈；optional / default 見 [通用鏈式](../chain)。

通用鏈見 [通用鏈式](../chain)；[object](./object)、[any](./any)、[boolean](./boolean)。
