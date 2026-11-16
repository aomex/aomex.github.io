---
outline: deep
---

# Ручная валидация

Вне Web-маршрутов прогоняйте произвольные данные через правила: unit-тесты, скрипты, свой middleware. В Web `body()` / `query()` тот же движок под капотом — здесь вы сами вызываете `validate`.

```typescript
import { validate } from '@aomex/common';
import { createUserSchema } from '../schemas/user.schema.js';

const input = { name: 'Ada', email: 'ada@example.com' };

const user = await validate(input, createUserSchema); // [!code highlight]
// 通过：user 已是 Infer 后的类型
// 失败：抛错（默认行为）
```

`mount: [body(createUserSchema)]` на маршруте — та же позиция «остановиться при ошибке», только ошибки оформляются как HTTP 400.

`validate` проверяет только форму; остаток на складе, права, дубликаты регистрации остаются в service / action.

`validate` возвращает Promise — без `await` вы прокинете Promise как данные.

- Первый аргумент широкий (`unknown`, конфиг, фикстуры); при успехе тип сужается до `Validator.Infer<typeof schema>`.
- По умолчанию `throwOnError: true`: при ошибке **нет** пригодного return — ловите в catch или дайте всплыть.
- С `{ throwOnError: false }` получите `{ data, errors }`; **успех — это `errors === null`**, не `data === null`: при `nullable()` законное значение может быть `null`.

::: warning
Считать ошибкой `data === null` — ошибка: поле с `nullable()` может успешно пройти как `null`.
:::

- При `throwOnError: false` и ошибке `errors` обычно `string[]` — удобно показать все поля формы сразу.

| Вариант | Когда использовать |
| --- | --- |
| `await validate(input, schema)` | Скрипты, тесты, middleware — остановить при ошибке |
| `validate(input, schema, { throwOnError: false })` | Админ-формы — показать **все** ошибки |
| Один `schema` + `validate` / `body()` | Правила в одном месте |

### Собрать ошибки без throw

```typescript
import { validate } from '@aomex/common';
import { createUserSchema } from '../schemas/user.schema.js';

const input = { name: '', email: 'not-email' };

const result = await validate(input, createUserSchema, { throwOnError: false }); // [!code highlight]

if (result.errors === null) {
  await db.user.create(result.data);
} else {
  return { ok: false, errors: result.errors };
}
```

### и маршруты

**HTTP-вход** — body / query / params; **чтение конфига, проверки перед Cron, фикстуры в тестах** — `validate`. Правила живут в `src/schemas/`.

Везде писать `validate` + свой `throw(400)` дублирует работу и рвёт OpenAPI — по возможности вешайте middleware.

## Дальше

- [schema](./schema)
- [Общие цепочки](./chain) (сужение по полям)
- [Формат ошибок](/ru/web/errors) (JSON-конверт при throw в Web)
