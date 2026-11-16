---
outline: deep
---

# rule.stream()

校驗 **可讀流**（Node Readable）：匯出任務源流、子程序 stdout、內部 job 管道（不是 JSON body 欄位）。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

```typescript
import { Readable } from 'node:stream';
import { rule, schema } from '@aomex/common';

export const exportSchema = schema({
  format: rule.literal('csv'),
  source: rule.stream().required(), // [!code highlight]
});
// Readable.from([...]) → 通过；{ foo: 1 } → 失败
```

- 通過後收窄為可讀流型別（以 Validator.Infer 為準）。
- 無專屬鏈；optional / required 見 [通用鏈式](../chain)。
- JSON 反序列化結果不會出現真流——別在 HTTP JSON 路由上指望它。

通用鏈見 [通用鏈式](../chain)；[file](./file)、[buffer](./buffer)、[literal](./literal)。
