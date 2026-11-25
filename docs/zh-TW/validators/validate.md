---
outline: deep
---

# 手動校驗

在**非 Web 路由**場景裡，拿任意資料對照規則過一遍：單測、指令碼、自己寫的中介軟體。Web 上掛 body() / query() 時，底層也是同一套；這裡是你親手調 `validate` 的入口。

```typescript
import { validate } from '@aomex/common';
import { createUserSchema } from '@/schemas/user.schema';

const input = { name: 'Ada', email: 'ada@example.com' };

const user = await validate(input, createUserSchema); // [!code highlight]
// 通过：user 已是 Infer 后的类型
// 失败：抛错（默认行为）
```

路由裡 `mount: [body(createUserSchema)]` 等價於這種「不過關就中斷」的姿勢，只是錯誤會被收成 HTTP 400。

validate 只管形狀；庫存、許可權、重複註冊仍在 service / action。

validate 返回 Promise，漏寫 await 會把 Promise 當結果用。

- 第一個引數是寬型別（配置、unknown、測試夾具）；成功後返回值收窄為 `Validator.Infer<typeof schema>`。
- 預設 throwOnError: true：失敗時**沒有**可用的返回值，直接進 catch 或冒泡。
- `{ throwOnError: false }` 時返回 `{ data, errors }`；**成功看 `errors === null`**，別看 `data === null`——開了 nullable() 時合法值本來就可以是 null。

::: warning
用 `data === null` 判斷失敗會誤判：nullable() 欄位通過時 data 可能就是 null。
:::

- 失敗且 `throwOnError: false` 時，errors 一般是 `string[]`，適合一次性回給表單多項紅字。

| 寫法 | 什麼時候用 |
| --- | --- |
| `await validate(input, schema)` | 指令碼、單測、中介軟體——失敗就停 |
| `validate(input, schema, { throwOnError: false })` | 管理後臺表單，要**全部**錯誤一起展示 |
| 同一份 `schema` + `validate` / `body()` | 規則只維護一處 |

### 不拋錯：收集全部錯誤

```typescript
import { validate } from '@aomex/common';
import { createUserSchema } from '@/schemas/user.schema';

const input = { name: '', email: 'not-email' };

const result = await validate(input, createUserSchema, { throwOnError: false }); // [!code highlight]

if (result.errors === null) {
  await db.user.create(result.data);
} else {
  return { ok: false, errors: result.errors };
}
```

### 和路由的分工

**HTTP 入口**用 body / query / params；**讀配置檔案、跑 Cron 前檢查、單測造資料**用 validate。規則都活在 `src/schemas/` 裡。

Web API 裡到處手寫 validate 再自己 throw(400) 既重複又讓 OpenAPI 不整齊——能掛中介軟體就掛。

## 下一步

- [schema](./schema)
- [通用鏈式](./chain)（在欄位上收窄形狀）
- [錯誤格式](/zh-TW/web/errors)（Web 裡拋錯後的 JSON 信封）
