---
outline: deep
---

# rule.enum()

把欄位限制在 **有限取值集合**：status、sort、role（寫進 OpenAPI enum）。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  sort: rule.enum(['asc', 'desc']).default('desc'), // [!code highlight]
});
// ?sort=asc → 'asc'；非法值 → 失败
```

- 推斷為聯合字面量或列舉成員型別（傳 TS enum 時）。
- pick / omit 得到新列舉驗證器，常保留 optional / default。
- pick / omit 結果為空，或 default 不在集合內，配置期會拋錯。

### pick(...values | values[])

**什麼時候用：** 全量狀態給管理端；使用者釋出介面只允許 draft → published。

```typescript
import { rule } from '@aomex/common';

const status = rule.enum(['draft', 'published', 'archived']);
status.pick('draft', 'published');
status.pick(['draft', 'published']);
```

### omit(...values | values[])

**什麼時候用：** 建立時不能選 archived；篩選下拉去掉內部態。

```typescript
import { rule } from '@aomex/common';

rule.enum(['draft', 'published', 'archived']).omit('archived');
```

改 default 後記得仍落在 pick/omit 後的集合裡。

### strict(is?: boolean)

**什麼時候用：** 數字列舉且 body 已是 number；query 字串常保持預設。

```typescript
import { rule } from '@aomex/common';

rule.enum([0, 1, 2]).strict();'1' → 失败；1 → 通过
```

通用鏈見 [通用鏈式](../chain)；[literal](./literal)、[oneOf](./one-of)、[string](./string)。
