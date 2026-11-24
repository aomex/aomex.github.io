---
outline: deep
---

# Теги

В OpenAPI **tag** группирует операции в боковой панели (левый столбец Swagger / Redoc). При сканировании маршрутов aomex вешает tags на каждую operation; если вы их не задали, по умолчанию используется **имя файла маршрута** (без расширения).

## Единый tag на Router

Для интерфейсов в одном файле и одной предметной области достаточно указать один раз в `new Router` — значение **поверхностно смержится** в `docs` каждого маршрута в этом файле:

```typescript
import { Router } from '@aomex/web';

export const router = new Router({ // [!code focus:4]
  prefix: '/users',
  docs: { tags: ['User'] }, // [!code highlight]
});

router.get('/', {
  docs: { summary: '用户列表' },
  action: async (ctx) => {
    ctx.send([]);
  },
});

router.get('/:id', {
  docs: { summary: '用户详情' },
  action: async (ctx) => {
    ctx.send({ id: 1 });
  },
});
```

Обе операции в документации окажутся в группе **User**. Если файл называется `user.router.ts` и tags не заданы, tag по умолчанию — `user.router` (плохо читается); для файлов по доменам лучше задать tags явно.

## Переопределение или дополнительный домен на одном маршруте

`docs` на уровне метода и на уровне Router **сливаются поверхностно** (позднее перекрывает раннее). Если меняете только `summary`, `tags` с Router сохранятся; если на методе тоже указать `tags`, они **полностью заменят** tags Router — массивы автоматически не объединяются.

```typescript
export const router = new Router({
  prefix: '/orders',
  docs: { tags: ['Order'] },
});

router.get('/export', {
  docs: { // [!code focus:4]
    tags: ['Order', 'Export'], // [!code highlight]
    summary: '导出订单',
  },
  action: async (ctx) => {
    ctx.send('ok');
  },
});
```

Для операций на стыке доменов (и заказ, и экспорт) перечислите несколько имён в одном массиве `tags`.

## Описание самого tag

`tags: ['User']` на маршруте задаёт только **имя**. Чтобы в шапке документации добавить к группе вводный текст (поддерживается Markdown), объявите элемент с тем же именем в `docs.tags` у `generateOpenapi`:

```typescript
import { generateOpenapi } from '@aomex/openapi-generator';
import { app } from './app.js';

await generateOpenapi({
  routers: './src/routers',
  app,
  docs: { // [!code focus:12]
    info: { title: 'My API', version: '1.0.0' },
    tags: [
      {
        name: 'User',
        description: '用户与资料。\n\n- 列表分页从 **1** 起\n- 详情 404 表示不存在', // [!code highlight]
      },
      { name: 'Order', description: '下单与履约' },
    ],
  },
});
```

После генерации фреймворк **допишет** в `document.tags` имена из маршрутов, которых ещё нет в `docs.tags` (только `name`, без description). Чтобы управлять текстом групп и их порядком, заранее перечислите в `docs.tags` все часто используемые группы.

Более длинный Markdown (заголовки, списки, ссылки) — см. [Markdown-тексты](/ru/openapi/markdown).

## И showInOpenapi

Чтобы маршрут не попал в контракт, задайте `docs: { showInOpenapi: false }` (например, для своего `/openapi.json`). Его tags не попадут в список использованных и не создадут пустую группу.

## Связанное

- [Markdown-тексты](/ru/openapi/markdown): длинные тексты в `info` и в `description` маршрутов
- [Генерация OpenAPI](/ru/openapi/): `generateOpenapi` и `app`
- [Swagger UI](/ru/openapi/swagger-ui) · [Redoc UI](/ru/openapi/redoc-ui): как выглядят группы в браузере