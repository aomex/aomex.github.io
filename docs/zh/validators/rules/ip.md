---
outline: deep
---

# rule.ip()

校验 **IP 字面量**：白名单里的 clientIp、VPN 对端、解析器地址（v4 / v6 在工厂选）。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const allowlistSchema = schema({
  peer: rule.ip('v4').required(), // [!code highlight]
});
// '203.0.113.10' → 通过；'2001:db8::1' 在只 v4 时 → 失败
```

- 通过后推断为 string。
- **版本只在工厂** rule.ip('v4' | 'v6' | [...])，没有 .v6() 链式。

### match(pattern: RegExp)

**什么时候用：** 在 IP 合法后再挡一段明显非公网段（复杂 CIDR 建议用专门库在 action 里做）。

```typescript
import { rule } from '@aomex/common';

rule.ip('v4').match(/^10\./);
// '10.0.0.1' → 通过；'203.0.113.1' → 失败
```

通用链见 [通用链式](../chain)；[string](./string)、[url](./url)、[hash](./hash)。
