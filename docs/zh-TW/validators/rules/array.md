---
outline: deep
---

# rule.array()

校驗 **陣列**：標籤列表、批次 ID、訂單行（元素可巢狀小物件形狀）。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const batchSchema = schema({
  ids: rule.array(rule.int()).length({ max: 100 }), // [!code highlight]
  tags: rule.array(rule.string()).length({ min: 1, max: 20 }),
});
```

- 元素規則決定 T[]；寫物件形狀時等價 array(object({...}))。
- unique 相關方法影響 OpenAPI uniqueItems 與否（見各方法說明）。
- forceToArray 後 query 單值也會變成陣列型別。

### length(n | { min?, max? })

**什麼時候用：** 至少一個標籤、批次最多 100 條、經緯度固定 2 元。

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).length({ min: 1, max: 20 });
rule.array(rule.number()).length(2);
```

### unique()

**什麼時候用：** 整項去重（Set 語義，物件按引用）；寫 OpenAPI uniqueItems: true。

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).unique();
// ['a','a'] → 失败
```

unique() 對物件元素按引用去重——兩個結構相同的不同物件不算重複。

### unique(key)

**什麼時候用：** 行物件按 sku / userId 去重；不支援 'a.b' 路徑；不寫 OpenAPI uniqueItems。

```typescript
import { rule } from '@aomex/common';

rule.array({ sku: rule.string(), qty: rule.int() }).unique('sku');
```

### unique(fn)

**什麼時候用：** 大小寫不敏感標籤、按歸一化欄位去重。

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).unique((s) => { // [!code highlight]
  return s.toLowerCase();
});
// ['Ada', 'ada'] → 失败
```

### forceToArray('separator', separator?)

**什麼時候用：** query ?tags=a,b,c 或 ?ids=1,2,3 進來是字串。

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).forceToArray('separator');
rule.array(rule.int()).forceToArray('separator', '|');
```

### forceToArray('block')

**什麼時候用：** 單選 ?tag=news 是字串而非 ['news']。

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).forceToArray('block');
// 'news' → ['news']
```

query 陣列忘了 forceToArray 時，單值和多值形態不一致容易 400。

通用鏈見 [通用鏈式](../chain)；[object](./object)、[string](./string)、[int](./int)。
