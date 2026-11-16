---
outline: deep
---

# rule.buffer()

校驗 **Node.js Buffer**：簽名 hex、加密密文、佇列任務裡的原始位元組（非普通 JSON 裡的 Buffer）。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const attestationSchema = schema({
  signature: rule.buffer().parseFrom('base64').required(), // [!code highlight]
});
// 'SGVsbG8=' → Buffer
```

- 預設只收真 Buffer；未開 parseFrom 時 JSON 字串不會自動轉。
- parseFrom('hex', 'base64') 後欄位推斷仍為 Buffer。
- 瀏覽器 JSON body 不能直接傳 Buffer——對外幾乎都走字串 + parseFrom。

### parseFrom(...encodings: 'hex' | 'base64')

**什麼時候用：** REST JSON 傳 hex 簽名、base64 圖片位元組；可列多種按實現嘗試。

```typescript
import { rule } from '@aomex/common';

rule.buffer().parseFrom('base64').required();
rule.buffer().parseFrom('hex', 'base64');
```

只驗「像 hex 的字串」不轉 Buffer 時用 [string](./string) + match 或定長 [hash](./hash)。

通用鏈見 [通用鏈式](../chain)；[file](./file)、[hash](./hash)、[string](./string)。
