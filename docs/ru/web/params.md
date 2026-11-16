---
outline: deep
---

# Параметры пути

После того, как маршрут записан в виде шаблона, такого как /users/:id, соответствующие сегменты сначала будут помещены в виде **строки**. `ctx.request.params` внутри. Используйте params() в методе mount для проверки типа и диапазона и используйте чистый ctx.params в бизнесе; форма недействительна **400**, и если такой человек не найден, будет возвращено **404**.

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

:id может соответствовать любой строке, но не представляет собой допустимый идентификатор — диапазон и UUID передаются валидатору; используйте **400** для неправильной формы, а затем используйте **404**, если такого человека нет, иначе мониторинг расценит техническую ошибку как нехватку ресурсов.

` params({ id: rule.int().min(1) })`После этого ctx.params.id — это номер. Шаблон маршрутизации: идентификатор пользователя и идентификатор пользователя ключа схемы должны совпадать. Когда функция params() не подключена, остается только строка: «42» и 42 легко спутать в деловых кругах. Если путь вообще не соответствует маршруту, функция params() не будет выполнена. Это проблема 404, а не проверка 400.

Маршрут пишет:userId но ` params({ id: ... })`Имя ключа будет неправильным; не используйте запрос для повторной передачи идентификатора и используйте запрос в качестве стандарта — если путь и запрос несовместимы, кеш, разрешения и журналы будут испорчены.

## UUID и многосегментные пути

Используется, когда внешний идентификатор — UUID. ` rule.uuid()`, не рассматривайте любую строку как допустимый первичный ключ. На пути имеется несколько разделов пространства (`/users/:userId/posts/:postId `), в **то же**` params({ ... })`Здесь объявляются все ключи, а имена ключей должны соответствовать шаблону маршрутизации.

Ресурсы, которые предоставляют UUID внешнему миру:

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

## Повторное использование схемы параметров

`:id ` Если он появляется неоднократно в нескольких маршрутах, поместите ` params` Форма извлекается в файл схемы по той же процедуре, что и [Тело запроса](/ru/web/body). При изменении правила ID (int → uuid) меняйте только схему.

```typescript
// src/schemas/user-id-param.schema.ts
import { schema, rule } from '@aomex/common';

export const userIdParamSchema = schema({
  id: rule.uuid(),
});
```

```typescript
import { params } from '@aomex/web';
import { userIdParamSchema } from '../schemas/user-id-param.schema.js';

router.get('/users/:id', { // [!code focus:5]
  mount: [params(userIdParamSchema)], // [!code highlight]
  action: async (ctx) => {
    ctx.send(await findUser(ctx.params.id));
  },
});
```

После установки params() параметр пути в OpenAPI автоматически становится обязательным.

## Дальше

- [Строка запроса](/ru/web/query)
- [Тело запроса](/ru/web/body)
- [HTTP-маршрутизация](/ru/web/router): статические пути сосуществуют с :id