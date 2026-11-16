---
outline: deep
---

# rule.any()

**暫時不約束形狀** 的 JSON 片段：外掛 settings、審計 before/after、遷移期未知欄位。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const pluginSchema = schema({
  name: rule.string().required(),
  settings: rule.any().optional(), // [!code highlight]
});
// settings 可以是对象、数组、字符串、数字等常见 JSON 形态
```

- 推斷會很寬（接近 unknown / 寬聯合，以編譯器為準）。
- 消費 ctx.body 時往往還要自己收窄或校驗二次。
- 無專屬鏈。

能建模時優先 [object](./object) / [record](./record)；第三方回撥整包、Admin JSON Blob 可過渡用 rule.any()。長期裸 any 會讓 OpenAPI 和 TS 都失去意義——遷移完成後收窄 schema。「鍵隨意、值同質」用 [record](./record)，不是 any。

通用鏈見 [通用鏈式](../chain)；結構化替代見 [record](./record)、[oneOf](./one-of)、[object](./object)。
