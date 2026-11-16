---
outline: deep
---

# rule.hash()

校驗 **十六進位制雜湊串形態**（按演算法定長）：contentMd5、etag、sha256 指紋（不算雜湊，只驗格式）。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const callbackSchema = schema({
  contentMd5: rule.hash('md5').required(), // [!code highlight]
});
// 'd41d8cd98f00b204e9800998ecf8427e' → 通过
```

- 通過後推斷為 string。
- 演算法只在工廠選：md5 / sha1 / sha256 / sha512 等；帶 0x 或 Base64 通常會失敗。

工廠第二個引數選演算法，例如 rule.hash('sha256')；未知演算法以型別提示與執行時報錯為準。

通用鏈見 [通用鏈式](../chain)；相近形態見 [string](./string)、[buffer](./buffer)、[file](./file)。
