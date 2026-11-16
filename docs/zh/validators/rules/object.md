---
outline: deep
---

# rule.object()

校验 **具名 JSON 对象**：body 里的 profile、嵌套字段表、把已有 schema 嵌进更大形状。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const userBody = schema({
  id: rule.int(),
  profile: rule.object({ // [!code highlight]
    bio: rule.string().optional(),
  }),
});
// 默认白名单：未声明字段会被丢掉
```

默认可丢掉未声明字段——客户端多传字段会「静默消失」，别当服务端会报错。

- 字段表决定推断形状；嵌套可写 rule.object({...}) 或裸 { key: rule... }。
- additional() 会保留或按规则保留额外键，类型会变宽。
- parseFromString 成功后仍是对象类型。

### additional()

**什么时候用：** Webhook 原样透传、代理多出来的键也要入库（仍建议尽量白名单）。

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).additional();
// { id: 1, traceId: 'x' } → 两者都保留
```

### additional({ key?, value? })

**什么时候用：** 只保留 meta_* 键、额外值必须是 string、声明字段 + 同质扩展袋。

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).additional({ key: /^(meta|ext)_/ });
rule.object().additional({ value: rule.string() });
rule.object({ id: rule.int() }).additional({ value: rule.number() });
```

动态键且值同质、无固定字段时，优先 [record](./record)。

### parseFromString(is?: boolean)

**什么时候用：** form / query 把 JSON 塞进单个字符串，如 filter={"status":"on"}。

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).parseFromString();
// '{"id":1}' → { id: 1 }
```

### strict(is?: boolean)

**什么时候用：** body 已是对象；防止普通字符串被误当 JSON（除非再开 parseFromString(true)）。

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).strict();
```

同质动态键别硬 object() 空工厂，用 [record](./record)。

通用链见 [通用链式](../chain)；[record](./record)、[array](./array)、[oneOf](./one-of)。
