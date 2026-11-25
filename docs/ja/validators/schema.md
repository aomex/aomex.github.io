---
outline: deep
---

# schema

「ユーザー・注文・ページング」などのフィールド表を再利用ユニットにまとめ、`src/schemas/xxx.schema.ts` に置く。ルートでは body(schema) / query(schema)、テストでは `validate(input, schema)`——同じ規則、同じ `Validator.Infer` 型でコピペを減らす。

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

フィールドの optional / default 等は [共通チェーン](./chain) のまま；以下は主に **schema 自身**のメソッド。

- `Validator.Infer<typeof userSchema>` は検証通過後のオブジェクト型。狭化後の ctx.body と揃える。
- pick / omit / extend は**新しい** schema を返し、型も新規。OpenAPI コンポーネント名は自動継承しない。コンポーネント化する形状は各自 `asName(...)`。
- partial() で各フィールドが optional に。無引数 partial() で schema 内に transform があると型上呼べない場合あり——`partial('name', 'bio')` を使う。
- required() で逆に必須化。フィールドに default があると、必須化後も欠落は default へ。

| メソッド | いつ使う |
| --- | --- |
| `schema({ ... })` | 最初のユニット化 |
| `asName('User')` | OpenAPI `components.schemas` で `$ref` したい |
| `pick('email', 'password')` | ログインは二フィールドだけ |
| `omit('password')` | 対外 DTO、登録で `id` 不可 |
| `extend({ nickname: rule.string() })` | 登録でアカウントにフィールド追加 |
| `partial()` / `partial('name')` | PATCH、下書き |
| `required()` / `required('name')` | 下書きを本提出に |

### asName(name)

名前は後続の pick / omit / extend / partial / required 結果に**自動では伝播しない**——コンポーネント庫に入れる形状ごとに再度指定。

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

登録で body(userSchema) のまま omit('id') を忘れると、クライアントが主キーを変えられる——作成用 schema を別派生に。

### extend

同名は渡した側が優先。フィールド表でも別 schema でも可。

```typescript
export const accountSchema = schema({
  email: rule.email(),
  password: rule.string().length({ min: 8, max: 128 }),
}).asName('Account');

export const registerSchema = accountSchema.extend({ // [!code highlight]
  nickname: rule.string().trim().length({ min: 1, max: 32 }),
});
```

extend 後に新形状へ asName を忘れると、OpenAPI はインラインの塊のまま——$ref に不利。

### partial / required

```typescript
import { userSchema } from '@/schemas/user.schema';

userSchema.pick('name', 'email', 'bio').partial(); // [!code highlight]

const draftSchema = userSchema.partial();
draftSchema.required();
draftSchema.required('name', 'email');
```

無引数 partial() で transform 付きフィールドがあると型または実行が詰まることがある——`partial('name', 'bio')` を使う。

### リスト例：ページング query

```typescript
// src/schemas/list-query.schema.ts
export const listQuerySchema = schema({ // [!code highlight]
  page: rule.int().min(1).default(1),
  pageSize: rule.int().min(1).max(100).default(20),
  q: rule.string().trim().optional(),
});
```

page / pageSize に default あり：クライアント省略可。ログの「未传」は default 表示。

Web ルートでは body / query を掛けられるなら手書き validate + 自前 400 を避ける——型とエラー envelope が揃う。

エラーメッセージの言語はアプリ `language` に従う。[Web](/ja/web/#language) · [Console](/ja/console/#language)。

## 次に

- [手動検証](./validate)（スクリプト・単体テストで同じ schema）
- [object](./rules/object) / [array](./rules/array) / [oneOf](./rules/one-of)
- [リクエスト body](/ja/web/body) / [クエリ](/ja/web/query)