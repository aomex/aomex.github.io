---
outline: deep
---

# rule.number()

校验 **有限数字（可含小数）**：评分、比例、经纬度分量、完成度等非金额小数。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const ratingSchema = schema({
  score: rule.number().min(0).max(5).precision(1), // [!code highlight]
});
// body: { score: 4.56 } → 先 toFixed(1) 再比范围，常为 4.6
```

- 通过后推断为 number（不是 Decimal；金额用 [decimal](./decimal)）。
- query 里 '3.5' 默认可转成 3.5；strict() 后只收 number。
- precision(n) 会改变实际输出的小数位，类型仍是 number。

### min(n, inclusive?: boolean)

**什么时候用：** 不能为负的权重、进度、折扣系数下限。

```typescript
import { rule } from '@aomex/common';

rule.number().min(0);
rule.number().min(0, false); // 必须 > 0
```

### max(n, inclusive?: boolean)

**什么时候用：** 五星封顶、比例不超过 1、经度范围。

```typescript
import { rule } from '@aomex/common';

rule.number().min(0).max(5);
```

### precision(decimals: number)

**什么时候用：** 滑块一长串小数、接口约定「最多两位」；用 toFixed 截断后再参与 min/max。

```typescript
import { rule } from '@aomex/common';

rule.number().precision(2);
rule.number().min(0).max(100).precision(1);
```

precision 用 toFixed 截断/舍入后再参与 min/max，和业务里的银行家舍入不一致时，在 transform 或业务层处理。

### strict(is?: boolean)

**什么时候用：** JSON body 保证已是 number；query 保持默认宽松。

```typescript
import { rule } from '@aomex/common';

rule.number().strict();'1.5' → 失败
```

通用链见 [通用链式](../chain)；[int](./int)、[decimal](./decimal)、[bigint](./bigint)。
