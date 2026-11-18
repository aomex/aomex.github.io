---
outline: deep
---

# Scalar UI

Страница документации на базе [Scalar](https://github.com/scalar/scalar): современное чтение и проба в браузере. Контракт — с диска (openapi.json / yaml) или через `generateOpenapi` в рантайме. Можно вместе с [Swagger UI](/ru/openapi/swagger-ui) / [Redoc UI](/ru/openapi/redoc-ui) — **uriPrefix не должны пересекаться** (по умолчанию `/scalar`).

Откуда контракт: [Генерация OpenAPI](/ru/openapi/).

```bash
pnpm add @aomex/scalar-ui
```

В `WebApp.mount` повесь `scalarUI` — открываешь `/scalar` (или свой prefix) и листаешь спецификацию.

## Файл на диске или динамический generateOpenapi

**CI уже выгрузил** (частый случай):

```typescript
import { scalarUI } from '@aomex/scalar-ui';

mount: [
  scalarUI({ openapi: './openapi.json' }), // [!code highlight]
  routers('./src/routers'),
],
```

Поддерживаются пути yaml / yml. В браузере: `/scalar`; по тому же префиксу обычно лежит openapi.json для загрузки страницей.

**В ногу с боевыми роутами**:

```typescript
import { scalarUI } from '@aomex/scalar-ui';
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

mount: [ // [!code focus:12]
  scalarUI({
    uriPrefix: '/api-docs',
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

`scalarUI` — обычное Web-middleware. `openapi` — путь-строка или функция с `Document` (можно async); в функции передайте **тот же** `WebApp` (`app`) в `generateOpenapi`, иначе security / envelope разойдутся с продом. При site-wide [envelope](/ru/web/envelope) страницы документации автоматически `skipEnvelope`.

## uriPrefix, enable и headTags

| Опция / запись | Когда использовать |
| --- | --- |
| `openapi: './openapi.json'` / `.yaml` | После CI `aomex openapi` |
| `openapi: () => generateOpenapi(...)` | Не коммитить контракт; тот же `app` |
| `uriPrefix` | По умолчанию `/scalar`; лучше путь со **случайной строкой**, чтобы снизить риск сканирования |
| `enable` | Выкл. доку в публичном интернете или token / whitelist IP |
| `headTags` | Вставить в `<head>` страницы favicon, доп. meta / link |

`/scalar`, `/swagger` и похожие пути легко находят сканеры. Случайная строка в префиксе (например `/scalar-7c3e9a1f02b48d6e`) лишь усложняет обнаружение, **не заменяет** `enable` / внутреннюю сеть — как в [Swagger UI](/ru/openapi/swagger-ui).

```typescript
scalarUI({
  openapi: './openapi.json',
  uriPrefix: '/scalar-7c3e9a1f02b48d6e', // [!code highlight]
  enable: (ctx) => { // [!code highlight]
    const ipOk = ctx!.request.ip === '127.0.0.1';
    const tokenOk =
      ctx!.request.headers['x-docs-token'] === process.env.DOCS_TOKEN;
    return ipOk || tokenOk;
  },
});
```

Иконка сайта:

```typescript
scalarUI({
  openapi: './openapi.json',
  headTags: [
    {
      tag: 'link',
      props: {
        rel: 'shortcut icon',
        type: 'image/x-icon',
        href: '/favicon.ico',
      },
    },
  ],
});
```

Не пересекайте префикс с API; вместе со `swaggerUI` / `redocUI` у всех трёх разные `uriPrefix` (желательно со случайной строкой).

::: warning
Публичный docs UI без защиты — карта API (и проба, если она есть) для всех; случайный префикс + `enable` / изоляция сети вместе.
:::

Если в динамическом `openapi` забыли продовый `app`, auth и обёртка на странице не совпадут с интеграцией. В режиме файла после смены роутов снова выгрузи через [Генерация OpenAPI](/ru/openapi/).

Сравнение с Swagger / Redoc, совместная работа и сценарии — [Какой docs UI выбрать](/ru/openapi/choose-ui).

## Связанное

- [Какой docs UI выбрать](/ru/openapi/choose-ui)
- [Swagger UI](/ru/openapi/swagger-ui) · [Redoc UI](/ru/openapi/redoc-ui)
- [Генерация OpenAPI](/ru/openapi/)