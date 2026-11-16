---
outline: deep
---

# schema

Соберите таблицы полей пользователей, заказов и пагинации в переиспользуемые блоки в `src/schemas/xxx.schema.ts`: на маршрутах `body(schema)` / `query(schema)`, в тестах `validate(input, schema)` — один набор правил, один тип `Validator.Infer`, меньше копипаста.

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

Полевые `optional` / `default` по-прежнему в [Общие цепочки](./chain); ниже — методы **на уровне schema**.

- `Validator.Infer<typeof userSchema>` — тип объекта после проверки; должен совпадать с суженным `ctx.body`.
- `pick` / `omit` / `extend` дают **новые** schema и типы; имена компонентов OpenAPI не наследуются — вызовите `asName(...)` у каждой формы для библиотеки компонентов.
- `partial()` делает поля необязательными; голый `partial()` может быть заблокирован на уровне типов, если у поля есть `transform` — используйте `partial('name', 'bio')`.
- `required()` ужесточает обратно; у полей с `default` пропуск по-прежнему даёт значение по умолчанию.

| Метод | Когда использовать |
| --- | --- |
| `schema({ ... })` | Первый сбор в блок |
| `asName('User')` | `$ref` в OpenAPI `components.schemas` |
| `pick('email', 'password')` | Логин — только два поля |
| `omit('password')` | Публичные DTO, регистрация без `id` |
| `extend({ nickname: rule.string() })` | Регистрация добавляет поля к базе аккаунта |
| `partial()` / `partial('name')` | PATCH, черновые обновления |
| `required()` / `required('name')` | Черновик становится формальной отправкой |

### asName(name)

Имя **не** переносится на результаты `pick` / `omit` / `extend` / `partial` / `required` — вызовите `asName` снова у каждой формы в библиотеке компонентов.

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

Регистрация с `body(userSchema)` без `omit('id')` — клиент не должен задавать первичный ключ; для создания выведите отдельную schema.

### extend

При совпадении ключей побеждает аргумент; можно передать таблицу полей или другую schema.

```typescript
export const accountSchema = schema({
  email: rule.email(),
  password: rule.string().length({ min: 8, max: 128 }),
}).asName('Account');

export const registerSchema = accountSchema.extend({ // [!code highlight]
  nickname: rule.string().trim().length({ min: 1, max: 32 }),
});
```

Новая форма после `extend` без `asName` остаётся inline в OpenAPI — плохо для `$ref`.

### partial / required

```typescript
import { userSchema } from '../schemas/user.schema.js';

userSchema.pick('name', 'email', 'bio').partial(); // [!code highlight]

const draftSchema = userSchema.partial();
draftSchema.required();
draftSchema.required('name', 'email');
```

Голый `partial()` при `transform` на поле может застопорить типы или runtime — используйте именованный `partial('name', 'bio')`.

### Пример: query списка

```typescript
// src/schemas/list-query.schema.ts
export const listQuerySchema = schema({ // [!code highlight]
  page: rule.int().min(1).default(1),
  pageSize: rule.int().min(1).max(100).default(20),
  q: rule.string().trim().optional(),
});
```

`page` / `pageSize` с default — клиент может их не передавать; в логах «не передано» может отображаться как default.

На Web-маршрутах предпочитайте `body` / `query` вместо ручного `validate` и своих 400 — типы и конверт ошибок остаются согласованными.

Язык сообщений об ошибках следует `language` приложения — см. [Web](/ru/web/#language) · [Console](/ru/console/#language).

## Дальше

- [Ручная валидация](./validate) (та же schema в скриптах и тестах)
- [object](./rules/object) / [array](./rules/array) / [oneOf](./rules/one-of)
- [Тело запроса](/ru/web/body) / [Строка запроса](/ru/web/query)