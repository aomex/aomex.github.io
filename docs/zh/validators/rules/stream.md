---
outline: deep
---

# rule.stream()

校验 **可读流**（Node Readable）：导出任务源流、子进程 stdout、内部 job 管道（不是 JSON body 字段）。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。

```typescript
import { Readable } from 'node:stream';
import { rule, schema } from '@aomex/common';

export const exportSchema = schema({
  format: rule.literal('csv'),
  source: rule.stream().required(), // [!code highlight]
});
// Readable.from([...]) → 通过；{ foo: 1 } → 失败
```

- 通过后收窄为可读流类型（以 Validator.Infer 为准）。
- 无专属链；optional / required 见 [通用链式](../chain)。
- JSON 反序列化结果不会出现真流——别在 HTTP JSON 路由上指望它。

通用链见 [通用链式](../chain)；[file](./file)、[buffer](./buffer)、[literal](./literal)。
