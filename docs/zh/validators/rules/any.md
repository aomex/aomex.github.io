---
outline: deep
---

# rule.any()

**暂时不约束形状** 的 JSON 片段：插件 settings、审计 before/after、迁移期未知字段。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const pluginSchema = schema({
  name: rule.string().required(),
  settings: rule.any().optional(), // [!code highlight]
});
// settings 可以是对象、数组、字符串、数字等常见 JSON 形态
```

- 推断会很宽（接近 unknown / 宽联合，以编译器为准）。
- 消费 ctx.body 时往往还要自己收窄或校验二次。
- 无专属链。

能建模时优先 [object](./object) / [record](./record)；第三方回调整包、Admin JSON Blob 可过渡用 rule.any()。长期裸 any 会让 OpenAPI 和 TS 都失去意义——迁移完成后收窄 schema。「键随意、值同质」用 [record](./record)，不是 any。

通用链见 [通用链式](../chain)；结构化替代见 [record](./record)、[oneOf](./one-of)、[object](./object)。
