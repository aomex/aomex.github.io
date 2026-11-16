---
outline: deep
---

# rule.decimal()

用 **decimal.js** 校验金额、汇率、税率——避免 0.1 + 0.2 这类浮点误差。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const paySchema = schema({
  amount: rule.decimal().min('0.01').max('50000'), // [!code highlight]
});
// body: { amount: '19.99' } → Decimal 实例
```

- 通过后运行时多为 Decimal（来自 decimal.js），不是 number。
- default('0') 会把字符串/数字包成 Decimal 再当默认值。
- 响应 JSON 前一般要 .toString()，别把带方法的对象直接 JSON.stringify。

OpenAPI / 前端类型常常是 string，和运行时 Decimal 要在业务边界转换。

### min(value, inclusive?: boolean)

**什么时候用：** 最小支付额、余额非负、value 可为 string / number / Decimal。

```typescript
import { rule } from '@aomex/common';

rule.decimal().min('0.01');
rule.decimal().min(0, false);
```

### max(value, inclusive?: boolean)

**什么时候用：** 单笔封顶、折扣不超过 1。

```typescript
import { rule } from '@aomex/common';

rule.decimal().min('0.01').max('50000');
```

### default(value)

**什么时候用：** 新建账户余额从 0、可选运费默认 0（会包成 Decimal）。

```typescript
import { rule } from '@aomex/common';

rule.decimal().default('0');
```

### strict(is?: boolean)

**什么时候用：** 内部已传 Decimal 实例；对外 HTTP 一般保持默认收字符串。

```typescript
import { rule } from '@aomex/common';

rule.decimal().strict();'1.5' → 失败
```

校验通过后加减仍应在 Decimal 上算，展示层和存储层别混用裸 number。

通用链见 [通用链式](../chain)；[number](./number)、[int](./int)、[bigint](./bigint)。
