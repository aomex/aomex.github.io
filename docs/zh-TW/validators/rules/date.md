---
outline: deep
---

# rule.date()

把入參收成 **Date**：預約時間、生日、報表起止、埋點時間戳。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const bookingSchema = schema({
  at: rule.date().min(() => { // [!code highlight]
    return new Date();
  }),
});
// ISO 字符串或时间戳 → Date；早于 now → 失败
```

- 通過後推斷為 Date。
- 工廠可傳 Luxon 格式串；不傳時多按 ISO，預設可解析時間戳。
- min / max 要傳 **函式**，每次校驗取「當前」邊界，避免程序啟動時凍死。

### min(freshDate: () => Date, inclusive?: boolean)

**什麼時候用：** 不能約過去、生效日不早於今天。

```typescript
import { rule } from '@aomex/common';

rule.date().min(() => {
  return new Date();
});
```

::: warning
min / max 要傳函式每次取邊界；別寫成 min(new Date()) 凍在程序啟動時刻。
:::

### max(freshDate: () => Date, inclusive?: boolean)

**什麼時候用：** 不能選未來、活動結束一年內。

```typescript
import { rule } from '@aomex/common';

rule.date().max(() => {
  return new Date();
}); // [!code highlight]

rule.date().max(() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d;
});
```

### parseFromTimestamp(is?: boolean)

**什麼時候用：** 預設開——移動端毫秒時間戳；契約只要 ISO 時 parseFromTimestamp(false)。

```typescript
import { rule } from '@aomex/common';

rule.date(); // 1711257956199 → Date
rule.date().parseFromTimestamp(false);
```

自定義格式 token 見 [Luxon 文件](https://moment.github.io/luxon/#/formatting?id=table-of-tokens)。

只存日期、不關心時區時，業務和 DB 型別要對齊，別全靠預設 ISO 解析隱含時區。

通用鏈見 [通用鏈式](../chain)；[int](./int)（純時間戳數字欄位）、[string](./string)。
