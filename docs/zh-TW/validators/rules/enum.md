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

- 陣列入參推斷為聯合字面量（如 `'asc' | 'desc'`）。
- pick / omit 得到新列舉驗證器，常保留 optional / default。
- pick / omit 結果為空，或 default 不在集合內，配置期會拋錯。

業務裡已經有 TypeScript `enum`（或 `as const` 列舉物件）時，可以直接傳給 `rule.enum`，不必再手抄一份陣列：

```typescript
import { rule, schema } from '@aomex/common';

enum Color {
  Red = 'red',
  Blue = 'blue',
}

export const patchBody = schema({
  color: rule.enum(Color), // [!code highlight]
});
// { color: 'red' } → Color.Red；'green' → 失败
```

通過後的型別是列舉成員（`Color`），不是裸的 `'red' | 'blue'`——`ctx.body.color` 可以直接和 `Color.Red` 比較。數字 enum 同理，推斷為 `Status`：

```typescript
import { rule } from '@aomex/common';

enum Status {
  Off = 0,
  On = 1,
}

rule.enum(Status); // → Status
```

沒有 `enum` 關鍵字、只有常量物件時，加 `as const` 再傳入即可，推斷為取值聯合：

```typescript
import { rule } from '@aomex/common';

const Role = { Admin: 'admin', User: 'user' } as const;

rule.enum(Role); // → 'admin' | 'user'
```

物件的值只能是 string / number；布林值請用陣列寫法 `rule.enum([true, false])`。

### pick(...values | values[])

**什麼時候用：** 全量狀態給管理端；使用者釋出介面只允許 draft → published。

```typescript
import { rule } from '@aomex/common';

const status = rule.enum(['draft', 'published', 'archived']);
status.pick('draft', 'published');
status.pick(['draft', 'published']);
```

傳了 TS enum 時，pick / omit 用成員本身即可：`rule.enum(Color).pick(Color.Red, Color.Blue)`。

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

rule.enum([0, 1, 2]).strict();
// '1' → 失败；1 → 通过
```

通用鏈見 [通用鏈式](../chain)；[literal](./literal)、[oneOf](./one-of)、[string](./string)。
