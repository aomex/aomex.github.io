---
outline: deep
---

# Параметры пути

Шаблон вида `/users/:id` кладёт совпавший сегмент в `ctx.request.params` как **строку**. В `mount` — `params()` для типа и диапазона; в коде — уже `ctx.params`. Неверная форма — **400**, нет сущности — **404**.

```typescript
import { rule } from '@aomex/common';
import { params, Router } from '@aomex/web';

export const router = new Router();

router.get('/users/:id', { // [!code focus:15]
  mount: [
    params({ // [!code highlight]
      id: rule.int().min(1),
    }),
  ],
  action: async (ctx) => {
    const { id } = ctx.params;
    const user = await findUser(id);
    if (!user) {
      ctx.throw(404, 'user not found');
    }
    ctx.send(user);
  },
});
```

`:id` матчит любую строку — это не значит валидный ID; диапазон и UUID — валидатору. Ошибка формы — **400**, отсутствие — **404**, иначе мониторинг путает опечатки с «не найдено».

После `params({ id: rule.int().min(1) })` у `ctx.params.id` тип number. Ключ schema должен совпадать с `:userId` в шаблоне. Без `params()` только строки — легко смешать `"42"` и `42`. Если путь не совпал с маршрутом, `params()` не выполняется — это 404, не валидационный 400.

`:userId` в пути и `params({ id: ... })` — разные ключи. Не дублируй id в query и не делай query главным — расходится кэш, права и логи.

## UUID и несколько сегментов

Публичный ID — UUID: `rule.uuid()`. Несколько плейсхолдеров (`/users/:userId/posts/:postId`) — все ключи в **одном** `params({ ... })`, имена как в шаблоне.

Ресурс с UUID наружу:

```typescript
params({ id: rule.uuid() }),
```

```typescript
router.get('/users/:userId/posts/:postId', { // [!code focus:12]
  mount: [
    params({ // [!code highlight]
      userId: rule.int().min(1),
      postId: rule.int().min(1),
    }),
  ],
  action: async (ctx) => {
    const { userId, postId } = ctx.params;
    ctx.send({ userId, postId });
  },
});
```

## Переиспользование param schema

Повторяющийся `:id` — вынеси форму `params` в schema, как [body / query](/ru/web/body). Смена правил (int → uuid) — в одном месте.

```typescript
// src/schemas/user-id-param.schema.ts
import { schema, rule } from '@aomex/common';

export const userIdParamSchema = schema({
  id: rule.uuid(),
});
```

```typescript
import { params } from '@aomex/web';
import { userIdParamSchema } from '@/schemas/user-id-param.schema';

router.get('/users/:id', { // [!code focus:5]
  mount: [params(userIdParamSchema)], // [!code highlight]
  action: async (ctx) => {
    ctx.send(await findUser(ctx.params.id));
  },
});
```

После `params()` в OpenAPI path-параметры автоматически `in: path` и `required`.

## Дальше

- [Строка запроса](/ru/web/query)
- [Тело запроса](/ru/web/body)
- [Маршруты](/ru/web/router): статический путь и `:id`