---
outline: deep
---

# rule.buffer()

校验 **Node.js Buffer**：签名 hex、加密密文、队列任务里的原始字节（非普通 JSON 里的 Buffer）。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const attestationSchema = schema({
  signature: rule.buffer().parseFrom('base64').required(), // [!code highlight]
});
// 'SGVsbG8=' → Buffer
```

- 默认只收真 Buffer；未开 parseFrom 时 JSON 字符串不会自动转。
- parseFrom('hex', 'base64') 后字段推断仍为 Buffer。
- 浏览器 JSON body 不能直接传 Buffer——对外几乎都走字符串 + parseFrom。

### parseFrom(...encodings: 'hex' | 'base64')

**什么时候用：** REST JSON 传 hex 签名、base64 图片字节；可列多种按实现尝试。

```typescript
import { rule } from '@aomex/common';

rule.buffer().parseFrom('base64').required();
rule.buffer().parseFrom('hex', 'base64');
```

只验「像 hex 的字符串」不转 Buffer 时用 [string](./string) + match 或定长 [hash](./hash)。

通用链见 [通用链式](../chain)；[file](./file)、[hash](./hash)、[string](./string)。
