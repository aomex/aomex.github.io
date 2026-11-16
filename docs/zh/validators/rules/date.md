---
outline: deep
---

# rule.date()

把入参收成 **Date**：预约时间、生日、报表起止、埋点时间戳。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const bookingSchema = schema({
  at: rule.date().min(() => { // [!code highlight]
    return new Date();
  }),
});
// ISO 字符串或时间戳 → Date；早于 now → 失败
```

- 通过后推断为 Date。
- 工厂可传 Luxon 格式串；不传时多按 ISO，默认可解析时间戳。
- min / max 要传 **函数**，每次校验取「当前」边界，避免进程启动时冻死。

### min(freshDate: () => Date, inclusive?: boolean)

**什么时候用：** 不能约过去、生效日不早于今天。

```typescript
import { rule } from '@aomex/common';

rule.date().min(() => {
  return new Date();
});
```

::: warning
min / max 要传函数每次取边界；别写成 min(new Date()) 冻在进程启动时刻。
:::

### max(freshDate: () => Date, inclusive?: boolean)

**什么时候用：** 不能选未来、活动结束一年内。

```typescript
import { rule } from '@aomex/common';

rule.date().max(() => {
  return new Date();
}); // [!code highlight]

rule.date().max(() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d;
});
```

### parseFromTimestamp(is?: boolean)

**什么时候用：** 默认开——移动端毫秒时间戳；契约只要 ISO 时 parseFromTimestamp(false)。

```typescript
import { rule } from '@aomex/common';

rule.date(); // 1711257956199 → Date
rule.date().parseFromTimestamp(false);
```

自定义格式 token 见 [Luxon 文档](https://moment.github.io/luxon/#/formatting?id=table-of-tokens)。

只存日期、不关心时区时，业务和 DB 类型要对齐，别全靠默认 ISO 解析隐含时区。

通用链见 [通用链式](../chain)；[int](./int)（纯时间戳数字字段）、[string](./string)。
