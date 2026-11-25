---
outline: deep
---

# schema

把「使用者、訂單、分頁」這類欄位表收成一份可複用單元，放到 `src/schemas/xxx.schema.ts`，路由上 body(schema) / query(schema)，測試裡 `validate(input, schema)`——同一套規則、同一套 `Validator.Infer` 型別，少複製貼上。

```typescript
// src/schemas/user.schema.ts
import { schema, rule, type Validator } from '@aomex/common';

export const userSchema = schema({ // [!code highlight]
  id: rule.int(),
  name: rule.string().trim().length({ min: 1 }),
  email: rule.email(),
  password: rule.string().length({ min: 8 }),
});

export type User = Validator.Infer<typeof userSchema>;
```

```typescript
// src/routers/users.ts
import { body, Router } from '@aomex/web';
import { userSchema } from '@/schemas/user.schema';

export const router = new Router();

router.post('/register', {
  mount: [body(userSchema.omit('id'))], // [!code highlight]
  action: async (ctx) => {
    await register(ctx.body);
    ctx.send(201);
  },
});
```

欄位上的 optional / default 等仍是 [通用鏈式](./chain)；下面主要是 **schema 自己身上**的方法。

- `Validator.Infer<typeof userSchema>` 就是校驗通過後的物件型別，和 ctx.body 窄化後應對齊。
- pick / omit / extend 會產出**新** schema，型別也是新的一份；OpenAPI 元件名不會自動繼承，要進元件庫就各自再 asName(...)。
- partial() 後各欄位變可選；無參 partial() 若 schema 裡有人掛了 transform，型別上可能直接不讓你調——改用具名 partial('name', 'bio')。
- required() 反向收緊；欄位上已有 default 的，收緊後預設仍走預設。

| 方法 | 什麼時候用 |
| --- | --- |
| `schema({ ... })` | 第一次收成單元 |
| `asName('User')` | OpenAPI `components.schemas` 裡要 `$ref` |
| `pick('email', 'password')` | 登入只要兩欄位 |
| `omit('password')` | 對外 DTO、註冊不讓傳 `id` |
| `extend({ nickname: rule.string() })` | 註冊在賬號基礎上加欄位 |
| `partial()` / `partial('name')` | PATCH、`PATCH` 草稿 |
| `required()` / `required('name')` | 草稿變正式提交 |

### asName(name)

名稱**不會**自動傳到後面的 pick / omit / extend / partial / required 結果——每個要進元件庫的形狀自己再點一次。

```typescript
export const userSchema = schema({
  id: rule.int(),
  name: rule.string(),
  password: rule.string(),
}).asName('User'); // [!code highlight]

export const publicUserSchema = userSchema.omit('password').asName('PublicUser');
```

### pick / omit

```typescript
import { userSchema } from '@/schemas/user.schema';

userSchema.pick('email', 'password');
userSchema.omit('password');
```

註冊介面若直接 body(userSchema) 卻忘了 omit('id')，客戶端不該改主鍵——建立 schema 單獨派生一份。

### extend

同名以傳入為準；可傳欄位表，也可傳另一個 schema。

```typescript
export const accountSchema = schema({
  email: rule.email(),
  password: rule.string().length({ min: 8, max: 128 }),
}).asName('Account');

export const registerSchema = accountSchema.extend({ // [!code highlight]
  nickname: rule.string().trim().length({ min: 1, max: 32 }),
});
```

改了 extend 後若忘了給新形狀 asName，OpenAPI 裡仍是內聯一坨，不利於 $ref。

### partial / required

```typescript
import { userSchema } from '@/schemas/user.schema';

userSchema.pick('name', 'email', 'bio').partial(); // [!code highlight]

const draftSchema = userSchema.partial();
draftSchema.required();
draftSchema.required('name', 'email');
```

無參 partial() 若 schema 裡有人掛了 transform，型別或執行可能卡住——改用具名 partial('name', 'bio')。

### 列表示例：分頁 query

```typescript
// src/schemas/list-query.schema.ts
export const listQuerySchema = schema({ // [!code highlight]
  page: rule.int().min(1).default(1),
  pageSize: rule.int().min(1).max(100).default(20),
  q: rule.string().trim().optional(),
});
```

page / pageSize 有預設：客戶端可省略；日誌裡「未傳」會顯示成預設值。

Web 路由裡能掛 body / query 就別手寫 validate 再自己拋 400——型別和錯誤信封更統一。

報錯文案語言跟應用 language 走，見 [Web](/zh-TW/web/#language) · [Console](/zh-TW/console/#language)。

## 下一步

- [手動校驗](./validate)（指令碼、單測裡跑同一套 schema）
- [object](./rules/object) / [array](./rules/array) / [oneOf](./rules/one-of)
- [請求實體](/zh-TW/web/body) / [查詢引數](/zh-TW/web/query)