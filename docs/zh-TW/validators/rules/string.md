---
outline: deep
---

# rule.string()

校驗並收窄**一段可讀文本**：暱稱、標題、搜尋詞、備註。

通用鏈（optional / required / nullable / default / transform / docs 等）見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const nicknameSchema = schema({
  displayName: rule.string().trim().length({ min: 1, max: 32 }), // [!code highlight]
  q: rule.string().trim().optional(),
});
// body: { displayName: '  Ada  ' } → displayName 为 'Ada'
```

- 校驗通過後欄位推斷為 string（transform 之後以 transform 返回型別為準，見 [通用鏈式](../chain)）。
- 預設把空串 '' 當成「沒傳」；和 optional() 聯用時，空串往往變成 undefined。
- allowEmptyString() 之後，'' 會作為合法 string 保留。

### trim(is?: boolean)

**什麼時候用：** 表單、貼上、輸入法帶來的首尾空格——不 trim 會導致「看起來一樣」的值對不上庫。

```typescript
import { rule } from '@aomex/common';

rule.string().trim();
rule.string().trim().length({ min: 1, max: 32 });
```

### length(n | { min?, max? })

**什麼時候用：** 驗證碼位數、密碼最短長度、備註上限（按 JS 字串 .length，UTF-16 碼元）。

```typescript
import { rule } from '@aomex/common';

rule.string().length(6);
rule.string().length({ min: 8, max: 128 });
```

與 trim 聯用時，長度按 **trim 之後** 計算。

### match(pattern: RegExp)

**什麼時候用：** 使用者名稱只允許字母數字下劃線、固定邀請碼格式。郵箱 / URL / UUID 優先專用工廠。

```typescript
import { rule } from '@aomex/common';

rule.string().trim().match(/^[a-z][a-z0-9_]{2,31}$/i);
```

郵箱、URL、IP 等別用 match 湊合——專用工廠的 OpenAPI 語義更準。

### allowEmptyString()

**什麼時候用：** 搜尋框清空仍傳 q=、備註允許顯式存空串、和前端受控元件 value="" 對齊。

```typescript
import { rule } from '@aomex/common';

rule.string().allowEmptyString().default('');
// '' → ''（通过）；未调用时 optional 下 '' 常当没传
```

需要和 optional() 聯用卻又要把 '' 當合法值時，別忘了 allowEmptyString()——否則空串常像「沒傳」。

通用鏈見 [通用鏈式](../chain)；專用形態見 [email](./email)、[url](./url)、[uuid](./uuid)、[ip](./ip)、[hash](./hash)。
