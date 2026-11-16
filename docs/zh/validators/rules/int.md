---
outline: deep
---

# rule.int()

校验 **整数**：页码、数量、自增 ID、库存件数（在安全整数范围内）。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  page: rule.int().min(1).default(1), // [!code highlight]
  pageSize: rule.int().min(1).max(100).default(20),
});
// ?page=2 → page 为 2；省略 page → 1
```

- 通过后推断为 number，且运行时是整数（Number.isInteger）。
- query 里常进来是字符串 '2'；默认非 strict 会转成 2。
- default(n) 之后，客户端没传字段时类型上仍有 number。

超过 Number.MAX_SAFE_INTEGER 用 [bigint](./bigint)；订单金额、费率别用 int 或裸 [number](./number) 扛小数，见 [decimal](./decimal)。

### min(n, inclusive?: boolean)

**什么时候用：** 页码从 1 起、下单数量至少 1；inclusive: false 表示必须 **大于** n。

```typescript
import { rule } from '@aomex/common';

rule.int().min(1).default(1);
rule.int().min(0, false); // 必须 > 0
```

### max(n, inclusive?: boolean)

**什么时候用：** pageSize 封顶、批量 ID 上限。

```typescript
import { rule } from '@aomex/common';

rule.int().min(1).max(100).default(20);
```

与 [`number.min` / `number.max`](./number) 语义相同，本规则另外要求整数。

### strict(is?: boolean)

**什么时候用：** 纯 JSON body 已是 number；**query 一般别开**，否则 '1' 会挂。

```typescript
import { rule } from '@aomex/common';

rule.int().strict();'18' → 失败；18 → 通过；18.5 → 失败
```

::: warning
分页 query 上开 strict() 是常见自爆点——字符串页码进不来。
:::

通用链见 [通用链式](../chain)；[number](./number)（小数）、[bigint](./bigint)（超大整数）、[decimal](./decimal)（金额）。
