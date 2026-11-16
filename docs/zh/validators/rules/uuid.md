---
outline: deep
---

# rule.uuid()

校验 **UUID 字符串**（带连字符）：路径 :id、parentId、事件 correlationId。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const paramsSchema = schema({
  id: rule.uuid('v4'), // [!code highlight]
});
// '550e8400-e29b-41d4-a716-446655440000' → 通过
```

- 通过后推断为 string。
- 工厂可限定 v1～v8 或数组；不写版本时接受常见各版。
- 大小写一般不敏感。

### match(pattern: RegExp)

**什么时候用：** 极少——UUID 已够窄；真要叠业务前缀时（多数项目应用单独字段）。

```typescript
import { rule } from '@aomex/common';

rule.uuid('v4').match(/^550e8400-/);
```

通用链见 [通用链式](../chain)；[ulid](./ulid)、[string](./string)、[anyOf](./any-of)。
