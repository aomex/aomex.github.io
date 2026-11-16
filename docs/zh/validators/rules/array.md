---
outline: deep
---

# rule.array()

校验 **数组**：标签列表、批量 ID、订单行（元素可嵌套小对象形状）。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const batchSchema = schema({
  ids: rule.array(rule.int()).length({ max: 100 }), // [!code highlight]
  tags: rule.array(rule.string()).length({ min: 1, max: 20 }),
});
```

- 元素规则决定 T[]；写对象形状时等价 array(object({...}))。
- unique 相关方法影响 OpenAPI uniqueItems 与否（见各方法说明）。
- forceToArray 后 query 单值也会变成数组类型。

### length(n | { min?, max? })

**什么时候用：** 至少一个标签、批量最多 100 条、经纬度固定 2 元。

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).length({ min: 1, max: 20 });
rule.array(rule.number()).length(2);
```

### unique()

**什么时候用：** 整项去重（Set 语义，对象按引用）；写 OpenAPI uniqueItems: true。

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).unique();
// ['a','a'] → 失败
```

unique() 对对象元素按引用去重——两个结构相同的不同对象不算重复。

### unique(key)

**什么时候用：** 行对象按 sku / userId 去重；不支持 'a.b' 路径；不写 OpenAPI uniqueItems。

```typescript
import { rule } from '@aomex/common';

rule.array({ sku: rule.string(), qty: rule.int() }).unique('sku');
```

### unique(fn)

**什么时候用：** 大小写不敏感标签、按归一化字段去重。

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).unique((s) => { // [!code highlight]
  return s.toLowerCase();
});
// ['Ada', 'ada'] → 失败
```

### forceToArray('separator', separator?)

**什么时候用：** query ?tags=a,b,c 或 ?ids=1,2,3 进来是字符串。

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).forceToArray('separator');
rule.array(rule.int()).forceToArray('separator', '|');
```

### forceToArray('block')

**什么时候用：** 单选 ?tag=news 是字符串而非 ['news']。

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).forceToArray('block');
// 'news' → ['news']
```

query 数组忘了 forceToArray 时，单值和多值形态不一致容易 400。

通用链见 [通用链式](../chain)；[object](./object)、[string](./string)、[int](./int)。
