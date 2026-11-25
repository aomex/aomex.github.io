---
outline: deep
---

# schema

Собирает таблицы полей вроде «пользователь, заказ, пагинация» в переиспользуемый блок в `src/schemas/xxx.schema.ts`: на роуте `body(schema)` / `query(schema)`, в тестах `validate(input, schema)` — одни правила, один тип `Validator.Infer`, меньше копипаста.

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

optional / default на полях — как в [общей цепочке](./chain); ниже — методы **самой** schema.

- `Validator.Infer<typeof userSchema>` — тип объекта после проверки; сузившийся ctx.body должен совпасть.
- pick / omit / extend дают **новую** schema и новый тип; имя OpenAPI-компонента не наследуется — для библиотеки компонентов снова `asName(...)`.
- partial() делает поля опциональными; безаргументный partial() при transform на полях может быть запрещён типом — используйте `partial('name', 'bio')`.
- required() ужесточает; при default на поле пропуск всё равно идёт в default.

| Метод | Когда |
| --- | --- |
| `schema({ ... })` | Первичная сборка |
| `asName('User')` | `$ref` в OpenAPI `components.schemas` |
| `pick('email', 'password')` | Логин — два поля |
| `omit('password')` | Внешний DTO, регистрация без `id` |
| `extend({ nickname: rule.string() })` | Регистрация — доп. поля |
| `partial()` / `partial('name')` | PATCH, черновики |
| `required()` / `required('name')` | Черновик → финальная отправка |

### asName(name)

Имя **не** переезжает в результаты pick / omit / extend / partial / required — каждую форму в компоненты именуйте снова.

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

Регистрация с body(userSchema) без omit('id') — клиент может менять первичный ключ; для создания отдельная производная schema.

### extend

Одноимённое — из аргумента; можно таблицу полей или другую schema.

```typescript
export const accountSchema = schema({
  email: rule.email(),
  password: rule.string().length({ min: 8, max: 128 }),
}).asName('Account');

export const registerSchema = accountSchema.extend({ // [!code highlight]
  nickname: rule.string().trim().length({ min: 1, max: 32 }),
});
```

Забыли asName после extend — в OpenAPI останется inline, хуже для $ref.

### partial / required

```typescript
import { userSchema } from '@/schemas/user.schema';

userSchema.pick('name', 'email', 'bio').partial(); // [!code highlight]

const draftSchema = userSchema.partial();
draftSchema.required();
draftSchema.required('name', 'email');
```

Безаргументный partial() при transform на полях может застрять в типах или рантайме — `partial('name', 'bio')`.

### Пример: query пагинации

```typescript
// src/schemas/list-query.schema.ts
export const listQuerySchema = schema({ // [!code highlight]
  page: rule.int().min(1).default(1),
  pageSize: rule.int().min(1).max(100).default(20),
  q: rule.string().trim().optional(),
});
```

У page / pageSize есть default — клиент может не слать; в логах «не передано» будет default.

На Web-роутах, где можно body/query — не пишите validate и throw(400) вручную: типы и envelope ошибок ровнее.

Язык ошибок — по `language` приложения: [Web](/ru/web/#language) · [Console](/ru/console/#language).

## Дальше

- [validate](./validate) (скрипты, тесты — та же schema)
- [object](./rules/object) / [array](./rules/array) / [oneOf](./rules/one-of)
- [body](/ru/web/body) / [query](/ru/web/query)