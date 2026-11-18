---
outline: deep
---

# Генерация документации OpenAPI

На маршрутах **объяви контракт**, затем **просканируй маршруты и выгрузи OpenAPI 3.0** для интеграторов или CI. Swagger / Redoc — только способ читать этот JSON; цепочка в `@aomex/openapi`. В Web-процессе — `generateOpenapi`; запись в файл — [экспорт из Console](/ru/console/openapi).

Маршруты без `query` / `body` / `response` дадут пустые секции в документе — рантайм работает, контракт неполный. Сужение типов для `send` / `throw` — [ограничение ответов](/ru/web/response).

```bash
pnpm add @aomex/openapi
```

Повесь на list/detail валидаторы и `response()`, вызови `generateOpenapi` — получишь `openapi.json` для коммита (или Document в памяти). **Передай тот же экземпляр `WebApp`, что и в проде** (`app`): генератор читает глобальный `mount` и `envelope`, чтобы security, тела ошибок и обёртка не разошлись с боем.

## response и docs на маршрутах

Контракт с маршрута: `query` / `body` / `params` — входные схемы, `response()` — выходы по кодам, `docs` — summary и tags. Валидация в рантайме и сужение типов из того же источника; пропущенные куски в `openapi.json` останутся пустыми.

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

## Передай app и собери Document

`generateOpenapi` ждёт **экземпляр `WebApp`**, отдельный массив `mount` не передавай. Из `app` берутся глобальные middleware и [обёртка ответа](/ru/web/envelope) — единый источник для OpenAPI.

Когда CLI, тесты или скрипты **импортируют** модуль, раздели `new WebApp(...)` и `app.listen(...)` (или слушай порт только в entry процесса), иначе import поднимет сервер и займёт порт.

```typescript
// src/app.ts — только создание и экспорт, без listen
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
// src/main.ts — entry процесса слушает порт
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

- После `body` / `query` / `params` на маршруте `ctx.body`, `ctx.query` и т.д. в action уже сужены — как в схеме документа.
- С `response({ statusCode, content })` второй аргумент `ctx.send(200, …)` должен совпадать с `content`; объявил 200, а вызвал `send(201)` — обычно ошибка типов.
- Ручной `openapi.onMethod` для одного ответа **чаще меняет только JSON**, не сужает `ctx.send` — типы держишь сам.

Частые поля `response()`:

| Поле | Когда |
| --- | --- |
| `statusCode` | По одному mount на каждый код (200 / 201 / 204 / 404…) |
| `content` | Успешное JSON-тело; сужает `ctx.send` |
| `contentType` | Не JSON по умолчанию: CSV, HTML, бинарник |
| `headers` | Документировать `X-Request-Id` и т.п. |
| `example` | Примеры для док-сайта, на рантайм не влияет |

Не-JSON:

```typescript
response({
  statusCode: 200,
  contentType: 'text/csv', // [!code highlight]
  content: rule.string(),
  description: '导出 CSV',
});
```

Когда валидатор не покрывает ответ (бинарный поток и т.д.), на маршрут повесь middleware с `openapi.onMethod` — только правка генерации:

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

## generateOpenapi и рантайм

`generateOpenapi` сканирует каталог маршрутов, из `app` подтягивает глобальный `mount` / `envelope` и собирает OpenAPI Document в памяти — файл, Swagger/ReDoc или diff в CI. **HTTP не поднимает** и рантайм `ctx` сам не сужает — сужение с `mount` на маршрутах.

| Опция `generateOpenapi` | Когда |
| --- | --- |
| `routers` | Обязательно; тот же glob, что у Web |
| `app` | Тот же `WebApp`, что в проде (несёт `mount`, `envelope`) |
| `docs` | `info.title` / `version` / `description` |
| `fix` | `servers`, контакты, vendor extensions; один ответ лучше через `response()` на маршруте |

Динамическая отдача спеки (`/openapi.json`):

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

Скан на каждый запрос дорог при частых обращениях — кэшируй или отдавай статикой после CI.

::: warning
`app` в `generateOpenapi` **обязателен** (и в типах), конфигурация должна совпадать с продом (**тот же экземпляр** проще всего). Без `app` не соберётся; другой `mount` / `envelope` — в доке разъедутся auth, `formatError` и обёртка с боем.
:::

::: tip
Экспорт из Console и скрипты импортируют Web-модуль: раздели `new WebApp` и `app.listen`, чтобы CLI не поднимал HTTP при запуске.
:::

Фиксированный артефакт в CI / локально: Console `openapi()` + `aomex openapi` — [экспорт OpenAPI](/ru/console/openapi).

Открыть контракт в браузере: [Swagger UI](/ru/plugins/swagger-ui) · [Redoc UI](/ru/plugins/redoc-ui).

Где можно — веди ответы через `response()` на маршрутах, а не только `fix` по одному. Без `docs.summary` / `tags` JSON соберётся, интеграторам будет тяжело. Маршрут, который отдаёт JSON, обычно ставят `docs.showInOpenapi: false`, чтобы не описывать себя рекурсивно.

## Связанное

- [Ограничение ответов](/ru/web/response)
- [Обёртка ответа](/ru/web/envelope) (с `app` успех/ошибка сводятся в 200; коды с `skipEnvelope` остаются как в рантайме)
- [Формат ошибок](/ru/web/errors)
- [Экспорт OpenAPI](/ru/console/openapi)
- [Swagger UI](/ru/plugins/swagger-ui) · [Redoc UI](/ru/plugins/redoc-ui)