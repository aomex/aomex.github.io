---
outline: deep
---

# Swagger UI

**Интерактивная** документация API на localhost или во внутренней сети. Нужен OpenAPI Document (`openapi.json` из CI или `generateOpenapi` в рантайме). Длинное чтение: [Redoc UI](/ru/plugins/redoc-ui); оба могут сосуществовать — **разные префиксы**.

Контракт: [Генерация OpenAPI](/ru/plugins/openapi) · [Экспорт OpenAPI](/ru/console/openapi).

```bash
pnpm add @aomex/swagger-ui
```

`swaggerUI` в `WebApp.mount`; разработчики открывают `/swagger` (или ваш prefix) и Try it out.

## Статический файл или динамический generateOpenapi

**Экспорт из CI** (частый вариант):

```typescript
import { swaggerUI } from '@aomex/swagger-ui';

mount: [
  swaggerUI({ openapi: './openapi.json' }), // [!code highlight]
  routers('./src/routers'),
],
```

В браузере `/swagger` (или `/swagger/index.html`); JSON спецификации обычно под тем же префиксом, что и `openapi.json`.

**В синхроне с живыми маршрутами** (без статического файла):

```typescript
import { swaggerUI } from '@aomex/swagger-ui';
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

mount: [ // [!code focus:12]
  swaggerUI({
    uriPrefix: '/docs',
    openapi: () => { // [!code highlight]
      return generateOpenapi({
        routers: './src/routers',
        app,
      });
    },
  }),
  routers('./src/routers'),
],
```

`swaggerUI` — обычный Web-middleware; вывод типов бизнес-маршрутов не меняет. `openapi` — **строка пути** или **функция с `Promise<Document>`**; в функции передавайте **тот же** `WebApp` (`app`) в `generateOpenapi`, иначе security/envelope в доке разъедутся с продом.

`enable` как функция получает контекст запроса для внутренних ворот — boolean проверяется типами.

## uriPrefix и enable в проде

| Опция / паттерн | Когда использовать |
| --- | --- |
| `openapi: './openapi.json'` | После `aomex openapi` в CI |
| `openapi: () => generateOpenapi(...)` | Без коммита файла контракта; тот же `app` |
| `uriPrefix` | Не занимать дефолтный `/swagger` |
| `enable` | Выключить в публичном интернете или token / IP allowlist |

Пример ограничения в проде:

```typescript
swaggerUI({
  openapi: './openapi.json',
  enable: (ctx) => { // [!code highlight]
    const ipOk = ctx!.request.ip === '127.0.0.1';
    const tokenOk =
      ctx!.request.headers['x-docs-token'] === process.env.DOCS_TOKEN;
    return ipOk || tokenOk;
  },
});
```

Перед или после `routers` обычно ок — **не пересекайте префиксы API** (бизнес `/docs` vs `uriPrefix: '/docs'`). С `redocUI` — разные префиксы.

::: warning
Публичный Swagger = карта API + Try it out; как минимум `enable` или изоляция сети.
:::

`openapi: () => generateOpenapi(...)` без живого `app` покажет «без auth» и пустой envelope, а вызовы дадут 401. В статическом режиме код меняется, файл нет — UI устаревает.

## Связанное

- [Redoc UI](/ru/plugins/redoc-ui)
- [Генерация OpenAPI](/ru/plugins/openapi)
- [Экспорт OpenAPI](/ru/console/openapi)
