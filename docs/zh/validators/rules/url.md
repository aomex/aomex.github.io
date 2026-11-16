---
outline: deep
---

# rule.url()

校验 **URL 字符串**：头像、首页、回调地址、文档链接（默认 http / https）。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const profileSchema = schema({
  avatar: rule.url().optional(), // [!code highlight]
});
// 'https://cdn.example.com/u/1.png' → 通过；'not a url' → 失败
```

- 通过后推断为 string（通过值常是规范化后的 URL 字符串，以运行时为准）。
- scheme([...]) **覆盖**默认协议列表，不是追加。

### scheme(schemes: string[])

**什么时候用：** 生产回调只要 HTTPS；内网镜像允许 http+https；少见协议（ftp 等）显式列出。

```typescript
import { rule } from '@aomex/common';

rule.url().scheme(['https']).required();
rule.url().scheme(['https', 'http']);
```

通用链见 [通用链式](../chain)；[email](./email)、[string](./string)、[ip](./ip)。
