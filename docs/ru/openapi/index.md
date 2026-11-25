---
outline: deep
---

# Генерация OpenAPI

На маршрутах **объяви контракт**, затем собери OpenAPI 3.0: в памяти — для скриптов и Swagger, или через Console **запиши в файл** для CI и SDK. Генерация в `@aomex/openapi-generator`; Swagger / Redoc — только способ прочитать этот JSON.

Маршруты без `query` / `body` / `response` дадут пустые соответствующие разделы в документе — рантайм работает, контракт неполный. Сужение типов для `send` / `throw` — [ограничение ответов](/ru/web/response).

```bash
pnpm add @aomex/openapi-generator
```

**Передай тот же экземпляр `WebApp`, что и в проде** (`app`): генератор читает его глобальный `mount` и `envelope`, тогда security, тела ошибок и обёртка с меньшей вероятностью разойдутся с боевой средой.

## response и docs на маршрутах

Контракт с маршрута: `query` / `body` / `params` задают входные схемы, `response()` описывает выходы по кодам состояния, `docs` — summary и tags. Валидация в рантайме и сужение типов из того же источника; пропущенные части в `openapi.json` останутся пустыми.

Как задавать группировку и переопределять tag по умолчанию из имени файла — см. [Теги](/ru/openapi/tags); Markdown в `info.description` и в длинных описаниях на маршрутах — [Markdown-тексты](/ru/openapi/markdown).

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

## Передай app и сгенерируй Document

`generateOpenapi` ожидает **экземпляр `WebApp`**, отдельный массив `mount` передавать не нужно. Из `app` берутся глобальные middleware и [обёртка ответа](/ru/web/envelope) — единый источник для инъекции в OpenAPI.

Когда CLI, тесты или скрипты **импортируют** модуль, раздели `new WebApp(...)` и `app.listen(...)` (или слушай порт только в entry процесса), иначе import поднимет сервер и займёт порт.

```typescript
// src/app.ts —— 只创建并导出，不 listen
import { formatError, routers, WebApp } from '@aomex/web';
import { rule } from '@aomex/common';
import { services } from '@/services';
import { logger } from '@/services/logger.service';

export const app = new WebApp({
  services,
  logger,
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
import { app } from '@/app';

app.listen(3000);
```

```typescript
import { writeFile } from 'node:fs/promises';
import { generateOpenapi } from '@aomex/openapi-generator';
import { app } from '@/app';

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
- Если вручную дополняешь один ответ через `openapi.onMethod`, **чаще меняется только сгенерированный JSON**, `ctx.send` автоматически не сужается — типы контролируешь сам.

Частые поля `response()`:

| Поле | Когда |
| --- | --- |
| `statusCode` | По одному mount на каждый код (200 / 201 / 204 / 404…) |
| `content` | Успешное JSON-тело; сужает `ctx.send` |
| `contentType` | Не JSON по умолчанию: CSV, HTML, бинарник |
| `headers` | Документировать `X-Request-Id` и т.п. |
| `example` | Примеры для док-сайта, на рантайм не влияет |

Пример не-JSON:

```typescript
response({
  statusCode: 200,
  contentType: 'text/csv', // [!code highlight]
  content: rule.string(),
  description: '导出 CSV',
});
```

Когда валидатор не покрывает ответ (бинарный поток и т.д.), на маршрут повесь middleware с `openapi.onMethod` — правится только результат генерации:

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

## Опции generateOpenapi и рантайм

`generateOpenapi` сканирует каталог маршрутов, из `app` подтягивает глобальный `mount` / `envelope` и собирает OpenAPI Document в памяти — файл, Swagger/ReDoc или diff в CI. **HTTP не поднимает** и рантайм `ctx` сам не сужает — сужение по-прежнему через `mount` на маршрутах.

| Опция `generateOpenapi` | Когда |
| --- | --- |
| `routers` | Обязательно; тот же glob, что у Web |
| `app` | Тот же `WebApp`, что в проде (несёт `mount`, `envelope`) |
| `docs` | `info.title` / `version` / `description` |
| `fix` | Дополнить `servers`, контакты, vendor extensions; один ответ лучше через `response()` на маршруте |

Динамическая отдача спеки (свой `/openapi.json`):

```typescript
import { app } from '@/app';

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

Скан на каждый запрос дорог при частых обращениях — кэшируй или переходи на запись из Console и статический файл ниже.

::: warning
`app` в `generateOpenapi` **обязателен** (и в типах), конфигурация должна совпадать с продом (**тот же экземпляр** проще всего). Без `app` не соберётся; другой `mount` / `envelope` — в доке разъедутся auth, `formatError` и обёртка с боевой средой.
:::

## Запись в файл из Console: `openapi()` + `aomex openapi`

Чтобы **записать контракт в файл**, не трогая HTTP-процесс, повесь в `mount` у `ConsoleApp` `openapi({ routers, app, saveToFile, … })` и выполни `aomex openapi`. Внутри та же генерация, только пакетная запись на диск.

```typescript
// src/cli.ts
import { openapi } from '@aomex/openapi-generator';
import { commanders, ConsoleApp } from '@aomex/console';
import { app } from '@/app';
import { services } from '@/services';
import { logger } from '@/services/logger.service';

new ConsoleApp({
  services,
  logger,
  language: 'zh-CN',
  mount: [
    openapi({ // [!code focus:18]
      routers: './src/routers',
      app, // [!code highlight]
      saveToFile: 'openapi.json',
      docs: {
        info: {
          title: 'My API',
          version: '1.0.0',
        },
      },
      fix: (doc) => {
        doc.servers = [{ url: 'https://api.example.com' }];
        return;
      },
    }),
    commanders('./src/commanders'),
  ],
});
```

```bash
npx aomex openapi
# 脚手架里常见：pnpm aomex openapi
```

После успеха в текущей рабочей директории (или по заданному пути) появится файл контракта. `routers` / `app` / `docs` / `fix` означают то же, что у `generateOpenapi`; дополнительно — `saveToFile` (по умолчанию `openapi.json`).

::: tip
Запись из Console и скрипты генерации импортируют Web-модуль: раздели `new WebApp` и `app.listen`, чтобы CLI при запуске не поднимал HTTP.
:::

::: warning
Путь `saveToFile` должен совпадать с каталогом артефактов CI, иначе пайплайн не найдёт файл и downstream SDK останется на старом контракте. После смены маршрутов или `mount` / `envelope` у `app` снова запусти `aomex openapi`, чтобы файл в репозитории не отставал.
:::

Пример архивации в CI:

```typescript
openapi({
  routers: './src/routers',
  app,
  saveToFile: 'artifacts/openapi.json', // [!code highlight]
  docs: {
    info: { title: 'My API', version: '1.0.0' },
  },
});
```

| Сценарий | Подход |
| --- | --- |
| Архивировать контракт на каждой сборке CI | `openapi()` + `aomex openapi` |
| Обновить файл локально после правок маршрутов | то же, запустить вручную |
| Отдавать свежий JSON по запросу в рантайме | Web-маршрут с `generateOpenapi({ routers, app })` |
| Пробовать вызовы в разработке | см. [Какой docs UI выбрать](/ru/openapi/choose-ui), затем [Swagger](/ru/openapi/swagger-ui) / [Redoc](/ru/openapi/redoc-ui) / [Scalar](/ru/openapi/scalar-ui) — читать файл с диска или динамический `generateOpenapi` |

Запись в файл и динамический `/openapi.json` в рантайме — разные вещи: частое онлайн-сканирование грузит CPU; на проде для док-сайта чаще берут запись на диск и статику или UI-плагин поверх файла.

Где можно — веди ответы через `response()` на маршрутах, а не только правки в `fix` по одному. Без `docs.summary` и осмысленных tags JSON соберётся, но интеграторам будет тяжело читать документ — группировку и тексты см. [Теги](/ru/openapi/tags) · [Markdown-тексты](/ru/openapi/markdown). Маршрут, который отдаёт JSON спеки, обычно помечают `docs.showInOpenapi: false`, чтобы не описывать себя рекурсивно.

## Связанное

- [Теги](/ru/openapi/tags)
- [Markdown-тексты](/ru/openapi/markdown)
- [Ограничение ответов](/ru/web/response)
- [Обёртка ответа](/ru/web/envelope) (с `app` успех и ошибка сводятся в 200; коды с `skipEnvelope` остаются как в рантайме)
- [Формат ошибок](/ru/web/errors)
- [Какой docs UI выбрать](/ru/openapi/choose-ui) · [Swagger UI](/ru/openapi/swagger-ui) · [Redoc UI](/ru/openapi/redoc-ui) · [Scalar UI](/ru/openapi/scalar-ui)