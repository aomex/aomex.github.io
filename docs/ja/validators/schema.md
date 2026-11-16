---
outline: deep
---

# schema

「ユーザー、注文、ページング」といったフィールド表を再利用可能な単位にまとめ、`src/schemas/xxx.schema.ts` に置く。ルートでは body(schema) / query(schema)、テストでは `validate(input, schema)`——同じルール、同じ `Validator.Infer` 型でコピペを減らす。

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
import { userSchema } from '../schemas/user.schema.js';

export const router = new Router();

router.post('/register', {
  mount: [body(userSchema.omit('id'))], // [!code highlight]
  action: async (ctx) => {
    await register(ctx.body);
    ctx.send(201);
  },
});
```

フィールド上の optional / default などは引き続き [共通チェーン](./chain)；以下は主に **schema 自体**のメソッド。

- `Validator.Infer<typeof userSchema>` は検証通過後のオブジェクト型；ctx.body 狭化後と揃える。
- pick / omit / extend は**新しい** schema を生成し、型も新規；OpenAPI コンポーネント名は自動継承されない。コンポーネントに載せるならそれぞれ asName(...)。
- partial() 後は各フィールドが optional；引数なし partial() で schema 内に transform があると型上呼べないことがある——`partial('name', 'bio')` に切り替える。
- required() は逆に必須化；フィールドに default がある場合、締めても欠落時はデフォルト。

| メソッド | いつ使うか |
| --- | --- |
| `schema({ ... })` | 初めて単位にまとめる |
| `asName('User')` | OpenAPI `components.schemas` で `$ref` |
| `pick('email', 'password')` | ログインは 2 フィールドだけ |
| `omit('password')` | 外向け DTO、登録で `id` を渡させない |
| `extend({ nickname: rule.string() })` | アカウントにフィールド追加 |
| `partial()` / `partial('name')` | PATCH、下書き |
| `required()` / `required('name')` | 下書きから本提出 |

### asName(name)

名前は pick / omit / extend / partial / required の**結果に自動では伝わらない**——コンポーネントに載せる形状ごとに再度付ける。

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
import { userSchema } from '../schemas/user.schema.js';

userSchema.pick('email', 'password');
userSchema.omit('password');
```

登録 API で body(userSchema) のまま omit('id') を忘れると、クライアントが主キーを変えられる——作成用 schema は別途派生する。

### extend

同名は渡した方が優先；フィールド表でも別 schema でも渡せる。

```typescript
export const accountSchema = schema({
  email: rule.email(),
  password: rule.string().length({ min: 8, max: 128 }),
}).asName('Account');

export const registerSchema = accountSchema.extend({ // [!code highlight]
  nickname: rule.string().trim().length({ min: 1, max: 32 }),
});
```

extend 後に新形状への asName を忘れると、OpenAPI はインラインのままで $ref に不利。

### partial / required

```typescript
import { userSchema } from '../schemas/user.schema.js';

userSchema.pick('name', 'email', 'bio').partial(); // [!code highlight]

const draftSchema = userSchema.partial();
draftSchema.required();
draftSchema.required('name', 'email');
```

引数なし partial() で schema 内に transform があると型または実行が詰まることがある——`partial('name', 'bio')` にする。

### リスト例：ページング query

```typescript
// src/schemas/list-query.schema.ts
export const listQuerySchema = schema({ // [!code highlight]
  page: rule.int().min(1).default(1),
  pageSize: rule.int().min(1).max(100).default(20),
  q: rule.string().trim().optional(),
});
```

page / pageSize に default がある：クライアントは省略可；ログでは「未送信」がデフォルト値として見える。

Web ルートでは body / query を載せられれば手書き validate + 400 自前投げは避ける——型とエラーエンベロープが揃う。

エラーメッセージの言語はアプリの language に従う。[Web](/ja/web/#language) · [Console](/ja/console/#language) を参照。

## 次のステップ

- [手動バリデーション](./validate)（スクリプト・単体テストで同じ schema）
- [object](./rules/object) / [array](./rules/array) / [oneOf](./rules/one-of)
- [リクエストボディ](/ja/web/body) / [クエリパラメータ](/ja/web/query)
