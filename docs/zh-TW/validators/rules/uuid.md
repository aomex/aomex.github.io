---
outline: deep
---

# rule.uuid()

校驗 **UUID 字串**（帶連字元）：路徑 :id、parentId、事件 correlationId。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const paramsSchema = schema({
  id: rule.uuid('v4'), // [!code highlight]
});
// '550e8400-e29b-41d4-a716-446655440000' → 通过
```

- 通過後推斷為 string。
- 工廠可限定 v1～v8 或陣列；不寫版本時接受常見各版。
- 大小寫一般不敏感。

### match(pattern: RegExp)

**什麼時候用：** 極少——UUID 已夠窄；真要疊業務字首時（多數專案應用單獨欄位）。

```typescript
import { rule } from '@aomex/common';

rule.uuid('v4').match(/^550e8400-/);
```

通用鏈見 [通用鏈式](../chain)；[ulid](./ulid)、[string](./string)、[anyOf](./any-of)。
