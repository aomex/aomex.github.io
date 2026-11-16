---
outline: deep
---

# rule.ip()

校驗 **IP 字面量**：白名單裡的 clientIp、VPN 對端、解析器地址（v4 / v6 在工廠選）。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const allowlistSchema = schema({
  peer: rule.ip('v4').required(), // [!code highlight]
});
// '203.0.113.10' → 通过；'2001:db8::1' 在只 v4 时 → 失败
```

- 通過後推斷為 string。
- **版本只在工廠** rule.ip('v4' | 'v6' | [...])，沒有 .v6() 鏈式。

### match(pattern: RegExp)

**什麼時候用：** 在 IP 合法後再擋一段明顯非公網段（複雜 CIDR 建議用專門庫在 action 裡做）。

```typescript
import { rule } from '@aomex/common';

rule.ip('v4').match(/^10\./);
// '10.0.0.1' → 通过；'203.0.113.1' → 失败
```

通用鏈見 [通用鏈式](../chain)；[string](./string)、[url](./url)、[hash](./hash)。
