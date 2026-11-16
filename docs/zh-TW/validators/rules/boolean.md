---
outline: deep
---

# rule.boolean()

把開關類入參收成 **boolean**：是否釋出、?featured=1、JSON 裡的 isAdmin。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  published: rule.boolean().default(false), // [!code highlight]
});
// ?published=1 → true；省略 → false
```

- 通過後推斷為 boolean。
- 預設真/假字面量（如 'true'、1）會對映成布林；改列表後只有列表內值才過。
- default(false) 後，沒傳欄位時型別上仍有 boolean。

預設真值含 1 / '1' / true / 'true'，假值含 0 / '0' / false / 'false'。三態 UI（未選 / 是 / 否）別硬塞 boolean——用 optional() 或單獨列舉欄位。

### setTruthyValues(values: any[])

**覆蓋**預設真值列表（不是追加）。

**什麼時候用：** 老系統或 HTML 提交 yes / on / Y 而不是 true。

```typescript
import { rule } from '@aomex/common';

rule.boolean().setTruthyValues(['yes', 'on', 'Y', 1, true]);
// 'on' → true；覆盖后默认的 'true' 可能不再认
```

只改 setTruthyValues 卻忘了改假值列表時，容易出現「關不掉」或中間態全 400。

### setFalsyValues(values: any[])

**覆蓋**預設假值列表。

**什麼時候用：** 與真值列表成對，對方用 no / off 表示關。

```typescript
import { rule } from '@aomex/common';

rule.boolean()
  .setTruthyValues(['yes', 'on', 1, true])
  .setFalsyValues(['no', 'off', 0, false]);
```

不在兩份列表裡的值直接失敗；沒有 strict()，鬆緊完全靠列表。

通用鏈見 [通用鏈式](../chain)；多檔狀態見 [enum](./enum)，純文本開關名見 [string](./string)。
