---
outline: deep
---

# rule.bigint()

校验 **大整数**（bigint）：链上 wei、Snowflake ID、超过安全整数范围的计数。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const ledgerSchema = schema({
  amountWei: rule.bigint().min(0n), // [!code highlight]
});
// body: { amountWei: '9007199254740992' } → 9007199254740992n
```

- 通过后推断为 bigint。
- HTTP JSON 没有原生 bigint，body 里常见 **字符串** 数字，非 strict 会尝试转换。
- 序列化响应前要 .toString() 或自定义 replacer。

别把 bigint 直接丢进 JSON.stringify——客户端会炸。

### min(value: bigint, inclusive?: boolean)

**什么时候用：** 最小充值、游标必须大于上一页 ID（inclusive: false 为严格大于）。

```typescript
import { rule } from '@aomex/common';

rule.bigint().min(100n);
rule.bigint().min(100n, false);
```

### max(value: bigint, inclusive?: boolean)

**什么时候用：** 单笔上限、配额封顶。

```typescript
import { rule } from '@aomex/common';

rule.bigint().min(0n).max(10_000_000_000_000_000_000n);
```

### strict(is?: boolean)

**什么时候用：** 只收真正的 bigint，堵掉 '1e3' 等字符串边角。

```typescript
import { rule } from '@aomex/common';

rule.bigint().strict();'123' → 失败
```

通用链见 [通用链式](../chain)；[int](./int)、[decimal](./decimal)、[hash](./hash)。
