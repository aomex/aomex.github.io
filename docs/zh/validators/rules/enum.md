---
outline: deep
---

# rule.enum()

把字段限制在 **有限取值集合**：status、sort、role（写进 OpenAPI enum）。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  sort: rule.enum(['asc', 'desc']).default('desc'), // [!code highlight]
});
// ?sort=asc → 'asc'；非法值 → 失败
```

- 推断为联合字面量或枚举成员类型（传 TS enum 时）。
- pick / omit 得到新枚举验证器，常保留 optional / default。
- pick / omit 结果为空，或 default 不在集合内，配置期会抛错。

### pick(...values | values[])

**什么时候用：** 全量状态给管理端；用户发布接口只允许 draft → published。

```typescript
import { rule } from '@aomex/common';

const status = rule.enum(['draft', 'published', 'archived']);
status.pick('draft', 'published');
status.pick(['draft', 'published']);
```

### omit(...values | values[])

**什么时候用：** 创建时不能选 archived；筛选下拉去掉内部态。

```typescript
import { rule } from '@aomex/common';

rule.enum(['draft', 'published', 'archived']).omit('archived');
```

改 default 后记得仍落在 pick/omit 后的集合里。

### strict(is?: boolean)

**什么时候用：** 数字枚举且 body 已是 number；query 字符串常保持默认。

```typescript
import { rule } from '@aomex/common';

rule.enum([0, 1, 2]).strict();'1' → 失败；1 → 通过
```

通用链见 [通用链式](../chain)；[literal](./literal)、[oneOf](./one-of)、[string](./string)。
