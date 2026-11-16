---
outline: deep
---

# rule.object()

校驗 **具名 JSON 物件**：body 裡的 profile、巢狀欄位表、把已有 schema 嵌進更大形狀。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

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

預設可丟掉未宣告欄位——客戶端多傳欄位會「靜默消失」，別當服務端會報錯。

- 欄位表決定推斷形狀；巢狀可寫 rule.object({...}) 或裸 { key: rule... }。
- additional() 會保留或按規則保留額外部索引鍵，型別會變寬。
- parseFromString 成功後仍是物件型別。

### additional()

**什麼時候用：** Webhook 原樣透傳、代理多出來的鍵也要入庫（仍建議儘量白名單）。

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).additional();
// { id: 1, traceId: 'x' } → 两者都保留
```

### additional({ key?, value? })

**什麼時候用：** 只保留 meta_* 鍵、額外值必須是 string、宣告欄位 + 同質擴充套件袋。

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).additional({ key: /^(meta|ext)_/ });
rule.object().additional({ value: rule.string() });
rule.object({ id: rule.int() }).additional({ value: rule.number() });
```

動態鍵且值同質、無固定欄位時，優先 [record](./record)。

### parseFromString(is?: boolean)

**什麼時候用：** form / query 把 JSON 塞進單個字串，如 filter={"status":"on"}。

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).parseFromString();
// '{"id":1}' → { id: 1 }
```

### strict(is?: boolean)

**什麼時候用：** body 已是物件；防止普通字串被誤當 JSON（除非再開 parseFromString(true)）。

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).strict();
```

同質動態鍵別硬 object() 空工廠，用 [record](./record)。

通用鏈見 [通用鏈式](../chain)；[record](./record)、[array](./array)、[oneOf](./one-of)。
