---
outline: deep
---

# rule.allOf()

同一输入必须 **同时满足** 数组里每条规则；适合复用团队里的密码片段、API Key 格式叠拼。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。

```typescript
import { rule, schema } from '@aomex/common';

const passwordBase = rule.string().length({ min: 8, max: 72 });
const passwordDigit = rule.string().match(/\d/);

export const registerSchema = schema({
  password: rule.allOf([passwordBase, passwordDigit]).required(), // [!code highlight]
});
// 'passw0rd!' → 通过；'short' → 失败
```

- 推断为各规则输出类型的 **交叉**（常见是同型 string 叠规则）。
- 无专属链。
- 单字段上连续 .length().match() 可读性往往更好；allOf 强项是 **跨文件复用** 片段。

通用链见 [通用链式](../chain)；[string](./string)、[anyOf](./any-of)、[oneOf](./one-of)。
