---
outline: deep
---

# Ручная валидация

Вне **Web-роутов** — прогнать любые данные по правилам: тесты, скрипты, свой middleware. На Web `body()` / `query()` — тот же движок; здесь вы сами вызываете `validate`.

```typescript
import { validate } from '@aomex/common';
import { createUserSchema } from '@/schemas/user.schema';

const input = { name: 'Ada', email: 'ada@example.com' };

const user = await validate(input, createUserSchema); // [!code highlight]
// Успех: user уже типа после Infer
// Провал: throw (по умолчанию)
```

`mount: [body(createUserSchema)]` на роуте — то же «не прошёл — стоп», но ошибка упакована в HTTP 400.

validate — только форма; остатки, права, дубликаты — в service / action.

validate возвращает Promise; без await в результат попадёт Promise.

- Первый аргумент — широкий тип (конфиг, unknown, фикстуры). После успеха — `Validator.Infer<typeof schema>`.
- По умолчанию throwOnError: true: при провале нет возврата, только catch/всплытие.
- `{ throwOnError: false }` → `{ data, errors }`; **успех: `errors === null`**. Не судите по `data === null` — с nullable() законное значение может быть null.

::: warning
Провал по `data === null` даст ложные срабатывания при nullable().
:::

- При провале и `throwOnError: false` errors обычно `string[]` — показать все поля формы сразу.

| Вариант | Когда |
| --- | --- |
| `await validate(input, schema)` | Скрипты, тесты, middleware — провал = стоп |
| `validate(input, schema, { throwOnError: false })` | Админ-форма — **все** ошибки разом |
| Одна `schema` + validate / `body()` | Правила в одном месте |

### Без throw: собрать все ошибки

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

### Разделение с роутами

**HTTP** — body / query / params; **чтение конфига, проверка перед Cron, тестовые данные** — validate. Правила живут в `src/schemas/`.

validate + throw(400) по всему Web API дублирует код и ломает OpenAPI — вешайте middleware, где можно.

## Дальше

- [schema](./schema)
- [chain](./chain) (сужение на полях)
- [errors](/ru/web/errors) (JSON envelope после throw на Web)