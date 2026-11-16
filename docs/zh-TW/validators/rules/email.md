---
outline: deep
---

# rule.email()

校驗 **郵箱形態字串**：註冊賬號、通知收件人、邀請郵件（只驗格式，不驗郵箱是否存在）。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const registerSchema = schema({
  email: rule.email().required(), // [!code highlight]
});
// { email: 'ada@example.com' } → 通过；'ada@' → 失败
```

- 通過後推斷為 string；OpenAPI 側往往會標成 email 格式。
- 與 trim / 長度無專屬鏈——需要時在 [transform](../chain) 或業務側處理。

任何「必須是郵箱」的欄位用本工廠，別 string().match 冒充。登入名「郵箱或工號」用 [anyOf](./any-of)。

### match(pattern: RegExp)

**什麼時候用：** 企業註冊只允許公司域、內測白名單字尾（在郵箱格式通過之後再疊正則）。

```typescript
import { rule } from '@aomex/common';

rule.email().match(/@acme\.com$/i);
// 'ada@acme.com' → 通过；'ada@gmail.com' → 格式过、match 失败
```

match 只疊格式約束，不能替代「驗證碼已發」——投遞成功與否在業務層。

通用鏈見 [通用鏈式](../chain)；[string](./string)、[url](./url)、[anyOf](./any-of)。
