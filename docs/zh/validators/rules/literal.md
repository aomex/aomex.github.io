---
outline: deep
---

# rule.literal()

要求入参 **精确等于** 某个字面量：Webhook event、判别联合的 type、固定 action: 'ping'。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const pingSchema = schema({
  action: rule.literal('ping'), // [!code highlight]
});
// { action: 'ping' } → 通过；'pong' → 失败；'1' 与 1 不相等
```

- 推断收窄为具体字面量类型（如 'ping'）。
- 不做类型转换——'1' 与 1 是不同分支。
- 无专属链；optional / default 见 [通用链式](../chain)。

通用链见 [通用链式](../chain)；[enum](./enum)、[oneOf](./one-of)、[anyOf](./any-of)。
