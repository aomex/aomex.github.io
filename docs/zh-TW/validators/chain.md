---
outline: deep
---

# 通用鏈式

在任意 rule.xxx() 上掛**通用鏈**：管「傳沒傳、能不能 null、要不要預設值、嚴不嚴、轉不轉形、文件怎麼寫」。和 trim、min 這類**專屬**方法正交；專屬見 [驗證器列表](./builtins) 各專頁。

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  page: rule.int().min(1).default(1),
  q: rule.string().trim().optional(),
});

// GET ?page=2&q=ada  → { page: 2, q: 'Ada' }（若你还链了 transform）
// GET 省略 page     → { page: 1, q: undefined }
```

分頁預設值 + 可選搜尋詞，是你在專案裡最常搭的第一種組合。

- optional() 之後，欄位推斷裡常見 T | undefined；default(...) 之後多半是「必有值」，客戶端沒傳也會落到預設。
- nullable() 會單獨允許 null；和「沒傳」不是一回事，PATCH 清空欄位時型別上是 null，不是 undefined。
- strict() 開著時，字串 '18' 往往過不了 `rule.int()`；query 裡幾乎總是字串進來，通常**不對 query 開 strict**。
- transform(fn) 的返回型別會替換欄位型別——`rule.string().transform(...)` 之後推斷的是 transform 的返回值，不是 string。
- docs(...) **不改執行時型別**，隻影響 OpenAPI 後設資料。

個別組合類或 file 可能缺 default / strict，以專頁為準。

下面每個方法都帶「什麼時候用」和可複製 demo；鏈的順序可以先型別約束，再 default / optional，最後 transform 和 docs。

### optional()

欄位可以不傳。undefined 和預設的空串 '' 往往會當成「空」——開了 optional 就通過，值是 undefined。

**什麼時候用：** 列表篩選、PATCH 區域性更新、Console 可選 flag。

```typescript
import { rule } from '@aomex/common';

// GET /users?q=ada —— q 可以完全不出现
rule.string().trim().optional();
```

已 [default(...)](#default值-值) 時一般不必再寫 optional()——有 default 通常就夠。字串若要「空串也算有值」，用 [allowEmptyString()](./rules/string)。

### required()

optional() 的反向：再變回必填。

**什麼時候用：** 草稿 schema partial() 之後，正式提交再收緊。

```typescript
import { rule } from '@aomex/common';

const title = rule.string().optional();
title.required();
```

若已有 default(...)，調 required() **通常不會**去掉預設——預設仍走預設值。

### nullable()

允許 JSON 裡的 null，和「沒傳」分開。

**什麼時候用：** PATCH 裡「傳 null 清空，不傳表示不改」。

```typescript
import { rule } from '@aomex/common';

rule.string().nullable().optional();
// null → 清空；没传 → undefined，业务里跳过该字段

rule.int().nullable();
```

未開 nullable 時，null 有時會被當成「空」處理，具體以型別提示為準。

PATCH 要清空欄位用 nullable() 傳 null；要表示「不改」靠沒傳 → undefined——別隻用 optional() 卻分不清兩者。

### default(值 | () => 值)

沒傳或值為空時直接用預設，欄位變為非必填；預設值本身**一般不再走一遍型別校驗**。

**什麼時候用：** 分頁、排序、新建資源的初始狀態。

```typescript
import { rule } from '@aomex/common';

rule.int().min(1).default(1); // [!code highlight]
rule.enum(['asc', 'desc']).default('desc');
rule.date().default(() => {
  return new Date();
});
```

預設可以是函式，校驗時再呼叫——適合「當前時間」、讀配置。日誌裡「客戶端沒傳」會顯示成預設值，排障時要記得。

### strict(is?: boolean)

更硬的型別契約：常見效果是少做寬鬆轉換（比如字串悄悄變數字）。

**什麼時候用：** JSON body 契約很硬；**query / 表單**幾乎全是字串，常見做法是不開。

```typescript
import { rule } from '@aomex/common';

rule.int().strict();
// '18' → 失败

rule.object({ id: rule.int() }).strict();
```

傳 strict(false) 可關掉；不是每個工廠都有這條鏈（例如很多 boolean 場景不靠 strict）。

::: warning
query / 表單幾乎全是字串，在 query 上鍊 strict() 常見後果是整頁 400。
:::

### transform(fn)

校驗（含預設）成功後，再把值變成你要的形狀；**推斷型別跟著返回值走**。

**什麼時候用：** query 收 CSV、大小寫歸一化、入口處轉成業務列舉。

```typescript
import { rule } from '@aomex/common';

rule.string().transform((s) => {
  return s.split(',').map((x) => {
    return x.trim();
  });
}); // [!code highlight]

rule.string().optional().transform((s) => {
  return s ?? '';
});
```

可以返回 Promise。別在 transform 裡做許可權、配額等業務判斷——失敗路徑不清晰，留在 action / 服務層。帶 transform 的 schema 做無參 [partial()](./schema#partial) 時可能被限制，可只 partial 指定欄位名。

### docs(schema, mode?)

寫入 OpenAPI 的 description / example 等，**不影響執行時**。

**什麼時候用：** 對接前端、生成文件時要可讀欄位說明。

```typescript
import { rule } from '@aomex/common';

rule.string().docs({ description: '用户昵称', example: 'Ada' });
rule.string().docs({ title: 'Name' }, 'replace');
```

docs() 隻影響 OpenAPI 後設資料，**不會改變**執行時校驗行為。

| 引數 | 什麼時候用 |
| --- | --- |
| `mode: 'merge'`（預設） | 在已有 docs 上追加 |
| `mode: 'replace'` | 整份覆蓋 |

### Validator.has(source, Type)

靜態方法：探測驗證器或欄位表裡是否**巢狀包含**某驗證器類。

**什麼時候用：** 寫外掛、程式碼生成時偶爾用；業務 action 裡幾乎不需要。

```typescript
import { Validator, rule, StringValidator } from '@aomex/common';

Validator.has(rule.string(), StringValidator);
Validator.has({ nest: { name: rule.string() } }, StringValidator);
```

## 下一步

- [schema](./schema)（partial / pick / extend）
- [驗證器列表](./builtins)（按任務找 rule.xxx()）
- [查詢引數](/zh-TW/web/query) / [請求實體](/zh-TW/web/body)（鏈式規則掛到路由上）