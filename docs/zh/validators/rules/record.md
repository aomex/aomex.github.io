---
outline: deep
---

# rule.record()

表达 **`Record<string, V>`**：功能开关表、多语言文案、标签→权重——键名不固定、值类型统一。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const flagsSchema = schema({
  features: rule.record(rule.boolean()), // [!code highlight]
});
// { darkMode: true, beta: false } → 通过
```

- 等价 `rule.object().additional({ value })`，推断为「任意字符串键 + 固定值类型」。
- 值规则上的 min / optional 等照常挂在 **value** 那条 rule 上。
- 无本规则专属链；optional / default 见 [通用链式](../chain)。

通用链见 [通用链式](../chain)；[object](./object)、[any](./any)、[boolean](./boolean)。
