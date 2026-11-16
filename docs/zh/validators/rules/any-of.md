---
outline: deep
---

# rule.anyOf()

多条规则里 **至少满足一种** 即可；多种都能过也算成功（登录名：邮箱或工号、搜索 q：UUID 或 slug）。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const loginSchema = schema({
  account: rule.anyOf([ // [!code highlight]
    rule.email(),
    rule.string().match(/^@[a-z0-9_-]+$/i),
  ]).required(),
});
```

- 推断为各分支类型的 **联合**，比单条 string 宽。
- 无专属链；子规则各自链式。
- 必须「恰好一种」时用 [oneOf](./one-of)——重叠过宽在 oneOf 会失败，在 anyOf 通常仍过。

通用链见 [通用链式](../chain)；[oneOf](./one-of)、[allOf](./all-of)、[email](./email)、[string](./string)。
