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

- 数组入参推断为联合字面量（如 `'asc' | 'desc'`）。
- pick / omit 得到新枚举验证器，常保留 optional / default。
- pick / omit 结果为空，或 default 不在集合内，配置期会抛错。

业务里已经有 TypeScript `enum`（或 `as const` 枚举对象）时，可以直接传给 `rule.enum`，不必再手抄一份数组：

```typescript
import { rule, schema } from '@aomex/common';

enum Color {
  Red = 'red',
  Blue = 'blue',
}

export const patchBody = schema({
  color: rule.enum(Color), // [!code highlight]
});
// { color: 'red' } → Color.Red；'green' → 失败
```

通过后的类型是枚举成员（`Color`），不是裸的 `'red' | 'blue'`——`ctx.body.color` 可以直接和 `Color.Red` 比较。数字 enum 同理，推断为 `Status`：

```typescript
import { rule } from '@aomex/common';

enum Status {
  Off = 0,
  On = 1,
}

rule.enum(Status); // → Status
```

没有 `enum` 关键字、只有常量对象时，加 `as const` 再传入即可，推断为取值联合：

```typescript
import { rule } from '@aomex/common';

const Role = { Admin: 'admin', User: 'user' } as const;

rule.enum(Role); // → 'admin' | 'user'
```

对象的值只能是 string / number；布尔值请用数组写法 `rule.enum([true, false])`。

### pick(...values | values[])

**什么时候用：** 全量状态给管理端；用户发布接口只允许 draft → published。

```typescript
import { rule } from '@aomex/common';

const status = rule.enum(['draft', 'published', 'archived']);
status.pick('draft', 'published');
status.pick(['draft', 'published']);
```

传了 TS enum 时，pick / omit 用成员本身即可：`rule.enum(Color).pick(Color.Red, Color.Blue)`。

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

rule.enum([0, 1, 2]).strict();
// '1' → 失败；1 → 通过
```

通用链见 [通用链式](../chain)；[literal](./literal)、[oneOf](./one-of)、[string](./string)。
