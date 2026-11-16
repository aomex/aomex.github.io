---
outline: deep
---

# rule.allOf()

同一輸入必須 **同時滿足** 數組裡每條規則；適合複用團隊裡的密碼片段、API Key 格式疊拼。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

```typescript
import { rule, schema } from '@aomex/common';

const passwordBase = rule.string().length({ min: 8, max: 72 });
const passwordDigit = rule.string().match(/\d/);

export const registerSchema = schema({
  password: rule.allOf([passwordBase, passwordDigit]).required(), // [!code highlight]
});
// 'passw0rd!' → 通过；'short' → 失败
```

- 推斷為各規則輸出型別的 **交叉**（常見是同型 string 疊規則）。
- 無專屬鏈。
- 單欄位上連續 .length().match() 可讀性往往更好；allOf 強項是 **跨檔案複用** 片段。

通用鏈見 [通用鏈式](../chain)；[string](./string)、[anyOf](./any-of)、[oneOf](./one-of)。
