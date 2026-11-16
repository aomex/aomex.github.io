---
outline: deep
---

# rule.url()

校驗 **URL 字串**：頭像、首頁、回撥地址、文件連結（預設 http / https）。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const profileSchema = schema({
  avatar: rule.url().optional(), // [!code highlight]
});
// 'https://cdn.example.com/u/1.png' → 通过；'not a url' → 失败
```

- 通過後推斷為 string（通過值常是規範化後的 URL 字串，以執行時為準）。
- scheme([...]) **覆蓋**預設協議列表，不是追加。

### scheme(schemes: string[])

**什麼時候用：** 生產回撥只要 HTTPS；內網映象允許 http+https；少見協議（ftp 等）顯式列出。

```typescript
import { rule } from '@aomex/common';

rule.url().scheme(['https']).required();
rule.url().scheme(['https', 'http']);
```

通用鏈見 [通用鏈式](../chain)；[email](./email)、[string](./string)、[ip](./ip)。
