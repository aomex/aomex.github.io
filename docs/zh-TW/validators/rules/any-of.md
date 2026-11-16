---
outline: deep
---

# rule.anyOf()

多條規則裡 **至少滿足一種** 即可；多種都能過也算成功（登入名：郵箱或工號、搜尋 q：UUID 或 slug）。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const loginSchema = schema({
  account: rule.anyOf([ // [!code highlight]
    rule.email(),
    rule.string().match(/^@[a-z0-9_-]+$/i),
  ]).required(),
});
```

- 推斷為各分支型別的 **聯合**，比單條 string 寬。
- 無專屬鏈；子規則各自鏈式。
- 必須「恰好一種」時用 [oneOf](./one-of)——重疊過寬在 oneOf 會失敗，在 anyOf 通常仍過。

通用鏈見 [通用鏈式](../chain)；[oneOf](./one-of)、[allOf](./all-of)、[email](./email)、[string](./string)。
