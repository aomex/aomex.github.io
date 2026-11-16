---
outline: deep
---

# Генерация OpenAPI

**Контракт на маршрутах**, затем **скан в OpenAPI 3.0** для партнёров или CI. Swagger / Redoc — читатели; пайплайн в `@aomex/openapi`. Web — `generateOpenapi`; файл: [Экспорт в Console](/ru/console/openapi).

Маршруты без `query` / `body` / `response` оставят пустые разделы документа — рантайм работает, контракт неполный. Сужение типов для `send` / `throw`: [Ограничения response](/ru/web/response).

```bash
pnpm add @aomex/openapi
```

Повесьте валидаторы и `response()` на list/detail, вызовите `generateOpenapi` — коммитабельный `openapi.json` (или `Document` в памяти). **Тот же `WebApp` (`app`), что в проде** — глобальный `mount` и `envelope`; security, ошибки, обёртки.

## response и docs на маршрутах

Контракт из объявлений: `query` / `body` / `params` для входа, `response()` для кодов выхода, `docs` для summary/tags. Рантайм и дока из одного источника; без mount — пустые секции OpenAPI.

```typescript
// src/routers/user.ts
import { rule } from '@aomex/common';
import { query, response, Router } from '@aomex/web';

export const router = new Router({
  prefix: '/users',
  docs: { tags: ['User'] },
});

router.get('/', {
  docs: { summary: '用户列表' },
  mount: [query({ page: rule.int().min(1).default(1) })],
  action: async (ctx) => {
    ctx.send([]);
  },
});

router.get('/:id', { // [!code focus:14]
  docs: { summary: '用户详情' },
  mount: [
    response({ // [!code highlight]
      statusCode: 200,
      description: '找到用户',
      content: { id: rule.int(), name: rule.string() },
    }),
    response({ statusCode: 404, description: '不存在' }),
  ],
  action: async (ctx) => {
    // …
  },
});
```

## Передайте app в generateOpenapi

`generateOpenapi` ждёт **экземпляр `WebApp`** — не дублируйте массив `mount`. Берёт глобальный middleware и [конверт ответа](/ru/web/envelope) как единый источник для OpenAPI.

Когда CLI/тесты `import` модуль, **разделите** `new WebApp(...)` и `app.listen(...)` — иначе побочный HTTP и занятый порт.

```typescript
// src/app.ts —— 只创建并导出，不 listen
import { formatError, routers, WebApp } from '@aomex/web';
import { rule } from '@aomex/common';
import { services } from './services/index.js';

export const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:12]
    formatError({
      content: { code: rule.string(), message: rule.string() },
      handler(err) {
        return {
          code: err.code ?? 'ERROR',
          message: err.message,
        };
      },
    }),
    routers('./src/routers'),
  ],
});
```

```typescript
// src/main.ts —— 进程入口才听端口
import { app } from './app.js';

app.listen(3000);
```

```typescript
import { writeFile } from 'node:fs/promises';
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

const document = await generateOpenapi({ // [!code focus:11]
  routers: './src/routers',
  app, // [!code highlight]
  docs: {
    info: { title: 'My API', version: '1.0.0' },
  },
  fix: (doc) => {
    doc.servers = [{ url: 'https://api.example.com' }];
    return;
  },
});

await writeFile('openapi.json', JSON.stringify(document, null, 2));
```

- После `body` / `query` / `params` сужаются `ctx.body` / `ctx.query` в action — те же schema, что в доке.
- После `response({ statusCode, content })` `ctx.send(200, …)` должно совпадать с `content`; 200 в доке, а `send(201)` — обычно ошибка типов.
- Ручной `openapi.onMethod` для одного ответа **часто только JSON**, не типы `ctx.send` — вы сами.

Частые поля `response()`:

| Поле | Когда использовать |
| --- | --- |
| `statusCode` | Один mount на выход (200 / 201 / 204 / 404…) |
| `content` | Успешное JSON-тело; сужает `ctx.send` |
| `contentType` | CSV, HTML, бинарь не по умолчанию JSON |
| `headers` | В доке `X-Request-Id` и т.д. |
| `example` | Примеры в доке, без эффекта в рантайме |

Пример не-JSON:

```typescript
response({
  statusCode: 200,
  contentType: 'text/csv', // [!code highlight]
  content: rule.string(),
  description: '导出 CSV',
});
```

Когда валидаторы не описывают ответ (бинарный поток), middleware с `openapi.onMethod` патчит только генерацию:

```typescript
import { middleware } from '@aomex/common';

export const openapiBinaryFile = middleware.web({ // [!code focus:18]
  fn: async (_ctx, next) => {
    return next();
  },
  openapi: {
    onMethod(methodItem) { // [!code highlight]
      methodItem.responses ||= {};
      methodItem.responses['200'] = {
        description: '文件流',
        content: {
          'application/octet-stream': {
            schema: { type: 'string', format: 'binary' },
          },
        },
      };
    },
  },
});
```

## generateOpenapi vs рантайм

`generateOpenapi` читает каталог маршрутов и глобальный `mount` / `envelope` у `app`, строит `Document` в памяти — файл, Swagger/ReDoc, diff в CI. **HTTP не стартует** и не сужает рантайм-`ctx` — mount на маршрутах по-прежнему нужны.

| Опция `generateOpenapi` | Когда |
| --- | --- |
| `routers` | Обязательно; тот же glob, что у Web |
| `app` | Тот же `WebApp`, что в проде (mount, envelope) |
| `docs` | `info.title` / `version` / `description` |
| `fix` | Патч `servers`, контакты, расширения; по операции лучше `response()` на маршруте |

Рантайм-эндпоинт спецификации:

```typescript
import { app } from '../app.js';

router.get('/openapi.json', {
  docs: { showInOpenapi: false },
  action: async (ctx) => {
    const document = await generateOpenapi({ // [!code highlight]
      routers: './src/routers',
      app,
    });
    ctx.send(document);
  },
});
```

Перескан на каждый запрос дорог — кеш или CI + статический файл.

::: warning
`app` в `generateOpenapi` = **прод-конфиг** (проще тот же экземпляр). `routers` без `app` выкинет глобальный auth, `formatError`, `envelope` из доки.
:::

::: tip
Console export и скрипты `import` Web — разделите `new WebApp` и `app.listen`, чтобы CLI не поднимал HTTP.
:::

Файл в CI/локально: Console `openapi()` + `aomex openapi` — [Экспорт OpenAPI](/ru/console/openapi).

В браузере: [Swagger UI](/ru/plugins/swagger-ui) · [Redoc UI](/ru/plugins/redoc-ui).

`response()` на маршруте лучше, чем править каждую операцию в `fix`. Без `docs.summary` / tags сгенерируется, но партнёрам больнее. JSON, отдающий спеку, ставьте `docs.showInOpenapi: false`, чтобы не сослаться на себя.

## Связанное

- [Ограничения response](/ru/web/response)
- [Конверт ответа](/ru/web/envelope) (с `app` сводит success/error к 200)
- [Формат ошибок](/ru/web/errors)
- [Экспорт OpenAPI](/ru/console/openapi)
- [Swagger UI](/ru/plugins/swagger-ui) · [Redoc UI](/ru/plugins/redoc-ui)
