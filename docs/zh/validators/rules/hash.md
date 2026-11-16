---
outline: deep
---

# rule.hash()

校验 **十六进制哈希串形态**（按算法定长）：contentMd5、etag、sha256 指纹（不算哈希，只验格式）。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const callbackSchema = schema({
  contentMd5: rule.hash('md5').required(), // [!code highlight]
});
// 'd41d8cd98f00b204e9800998ecf8427e' → 通过
```

- 通过后推断为 string。
- 算法只在工厂选：md5 / sha1 / sha256 / sha512 等；带 0x 或 Base64 通常会失败。

工厂第二个参数选算法，例如 rule.hash('sha256')；未知算法以类型提示与运行时报错为准。

通用链见 [通用链式](../chain)；相近形态见 [string](./string)、[buffer](./buffer)、[file](./file)。
