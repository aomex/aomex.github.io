---
outline: deep
---

# Swagger UI

Повесь локально или во внутренней сети документацию API: **открыл — можно дергать**. Нужен OpenAPI Document (файл openapi.json на диске или `generateOpenapi` в рантайме). Для длинного чтения — [Redoc UI](/ru/openapi/redoc-ui); более современная проба — [Scalar UI](/ru/openapi/scalar-ui). Несколько UI можно держать вместе — **префиксы не должны пересекаться**.

Сначала [официальное демо](https://petstore.swagger.io/). Откуда контракт: [Генерация OpenAPI](/ru/openapi/).

```bash
pnpm add @aomex/swagger-ui
```

В `WebApp.mount` повесь `swaggerUI` — в разработке открывают `/swagger` (или ваш prefix) и смотрят спецификацию с Try it out.

## Файл на диске или динамический generateOpenapi

**CI уже выгрузил** (частый случай):

```typescript
import { swaggerUI } from '@aomex/swagger-ui';

mount: [
  swaggerUI({ openapi: './openapi.json' }), // [!code highlight]
  routers('./src/routers'),
],
```

В браузере: `/swagger` (или `/swagger/index.html`), JSON спецификации обычно по тому же префиксу — `openapi.json`.

**В ногу с боевыми роутами** (без статического файла):

```typescript
import { swaggerUI } from '@aomex/swagger-ui';
import { generateOpenapi } from '@aomex/openapi-generator';
import { app } from '@/app';

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

`swaggerUI` в mount — обычное Web-middleware, вывод типов для бизнес-роутов не ломает. `openapi` — **строка-путь** или **функция с `Promise<Document>`**; в функции передайте в `generateOpenapi` **тот же** `WebApp` (`app`), иначе security / envelope в доке разойдутся с продом.

`enable` как функция получает контекст запроса — удобно для внутреннего порога; boolean-возврат можно проверить типами.

## uriPrefix и enable в проде

| Опция / запись | Когда использовать |
| --- | --- |
| `openapi: './openapi.json'` | После CI `aomex openapi` |
| `openapi: () => generateOpenapi(...)` | Не коммитить контракт; тот же `app` |
| `uriPrefix` | Вместо `/swagger` по умолчанию; лучше **случайная строка**, чтобы снизить риск сканирования |
| `enable` | Выкл. доку в публичном интернете или token / whitelist IP |

`/swagger`, `/redoc`, `/scalar` по умолчанию легко угадать. В шаблоне часто пишут префикс вроде `/swagger-7c3e9a1f02b48d6e` — по типовым путям страницу не найти. Случайная строка **не заменяет** auth, только усложняет обнаружение; снаружи всё равно нужны `enable`, внутренняя сеть или шлюз.

```typescript
swaggerUI({
  openapi: './openapi.json',
  uriPrefix: '/swagger-7c3e9a1f02b48d6e',
});
```

В проде — барьер доступа:

```typescript
swaggerUI({
  openapi: './openapi.json',
  uriPrefix: '/swagger-7c3e9a1f02b48d6e',
  enable: (ctx) => { // [!code highlight]
    const ipOk = ctx!.request.ip === '127.0.0.1';
    const tokenOk =
      ctx!.request.headers['x-docs-token'] === process.env.DOCS_TOKEN;
    return ipOk || tokenOk;
  },
});
```

Где вешать: до или после `routers` обычно работает, но **не пересекайте префикс с API**; вместе с `redocUI` / `scalarUI` у каждого свой `uriPrefix` (лучше со случайной строкой).

::: warning
Публичный Swagger без защиты — карта API и Try it out для всех; случайный префикс + `enable` / изоляция сети вместе.
:::

Если в динамическом `openapi: () => generateOpenapi(...)` забыли продовый `app`, на странице может быть «без auth» и не та обёртка, а при интеграции — 401. В статическом режиме без обновления файла после правок кода UI показывает старый контракт.

Сравнение с Redoc / Scalar, совместная работа и сценарии — [Какой docs UI выбрать](/ru/openapi/choose-ui).

## Связанное

- [Какой docs UI выбрать](/ru/openapi/choose-ui)
- [Scalar UI](/ru/openapi/scalar-ui) · [Redoc UI](/ru/openapi/redoc-ui)
- [Генерация OpenAPI](/ru/openapi/)