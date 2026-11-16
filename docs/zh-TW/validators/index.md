---
outline: deep
---

# 驗證器

把一坨「外面隨便丟進來的資料」收成你敢用的物件：執行時攔住髒資料，TypeScript 裡型別跟著變窄。Web 的 body() / query()、Console 的 options()、OpenAPI，通常**共用同一套 rule**，少抄一份 interface。

```typescript
import { rule, validate, schema, type Validator } from '@aomex/common';
```

```typescript
import { rule, validate } from '@aomex/common';

const input = { name: '  Ada  ', age: '18', hack: true };

const user = await validate(input, { // [!code highlight]
  name: rule.string().trim().length({ min: 1, max: 32 }),
  age: rule.int().min(0).optional(),
});

await doSomething(user);
```

懸停 user：

- name → string（已 trim）
- age → number | undefined（'18' 一般會收成數字；可選）
- 沒有 hack——沒宣告的鍵，預設丟掉

在路由裡更常見：掛 `body({ ... })` 之後，ctx.body 直接是收窄後的型別，不必再手寫 validate。

::: tip
別維護 Zod 一套再加手寫 interface——改欄位時最容易漂；這裡一份 rule 扛執行時和型別兩邊。
:::

## 專案裡怎麼選工具

| 你想做的事 | 用什麼 |
| --- | --- |
| 單個欄位 | `rule.string()` / `rule.int()` … → [驗證器列表](./builtins) |
| 一堆欄位要複用 / PATCH 派生 | [`schema`](./schema)，放 `src/schemas/xxx.schema.ts` |
| 指令碼 / 測試裡驗一把 | [手動校驗](./validate) |
| 巢狀、陣列、二選一 | [object](./rules/object) / [array](./rules/array) / [oneOf](./rules/one-of) |
| 「傳沒傳 / 預設值 / 文件備註」 | [通用鏈式](./chain) |

真要透傳任意鍵，用 [rule.record()](./rules/record) 說清楚，別指望未宣告欄位會自動保留。

::: warning
rule.any() 能跑，但型別和 OpenAPI 都會糊；過渡用可以，儘量少留在對外 API。
:::

## 本欄目

| 篇目 | 什麼時候點開 |
| --- | --- |
| [驗證器列表](./builtins) | 找具體 `rule.xxx` |
| [通用鏈式](./chain) | `optional` / `default` / `transform`… |
| [schema](./schema) | pick / omit / partial |
| [Prisma](/zh-TW/plugins/prisma) | 從表結構生成校驗 |
| [手動校驗](./validate) | 指令碼 / 單測裡直接調 `validate` |
| [自定義驗證器](/zh-TW/advanced/validator) | 內建不夠時再來（高階） |
