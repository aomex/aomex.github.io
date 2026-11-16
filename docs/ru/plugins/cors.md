---
outline: deep
---

# CORS

Чтобы фронтенд в браузере мог корректно вызывать API: в разработке фронт и бэкенд часто на разных портах и нужен preflight; в проде сужайте список разрешённых **origin**; для Cookie настройте **credentials**.

```bash
pnpm add @aomex/cors
```

## Перед routers

`cors()` на этапе middleware выставляет заголовки `Access-Control-*`, чтобы браузер мог читать кросс-доменный ответ. Монтируйте **перед** `routers`, иначе все ответы (включая 4xx/5xx) не получат нужные заголовки — preflight пройдёт, а тело ошибки бизнес-логики останется недоступным.

```typescript
import { cors } from '@aomex/cors';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    cors(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

::: warning
CORS **после** `routers` может не добавить заголовки для 404 и валидационных 400 — браузер покажет «ошибку CORS» и скроет настоящую причину.
:::

Локально при разных портах безаргументный `cors()` часто отражает `Origin` из запроса — для разработки достаточно. В проде указывайте домены явно.

`cors()` — обычный `WebMiddleware`, новых полей на `ctx` нет; action пишете как раньше. При успехе виден `Access-Control-Allow-Origin`; с Cookie нужен `Access-Control-Allow-Credentials: true`, и **нельзя** использовать `origin: '*'`.

## Сужение Origin и credentials

| Опция | Когда использовать | По умолчанию |
| --- | --- | --- |
| `origin` | Фиксированный фронт в проде или функция-белый список для нескольких фронтов | Отражать `Origin` запроса |
| `credentials` | Кросс-доменные Cookie / заголовки авторизации | — |
| `allowHeaders` | Кастомные заголовки вроде `Authorization` | — |
| `exposeHeaders` | Чтобы JS читал `X-Request-Id` и т.п. | — |
| `maxAge` | Меньше OPTIONS; `-1` отключает кеш при отладке | `3600` |
| `allowMethods` | Ограничить только GET/POST | Набор типичных методов |
| `secureContext` / `privateNetworkAccess` | Изолированные страницы, публичный сайт → приватный API (Chrome PNA) | `false` |

### Прод: Cookie + один фронт

```typescript
cors({
  origin: 'https://app.example.com', // [!code highlight]
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-Request-Id'],
});
```

::: warning
При `credentials: true` **нельзя** `origin: '*'` — браузер отклонит запрос.
:::

### Прод: несколько origin фронтенда

```typescript
const allowlist = new Set([
  'https://app.example.com',
  'https://admin.example.com',
]);

cors({
  origin: (ctx) => { // [!code highlight]
    const origin = ctx.request.headers['origin'];
    if (origin && allowlist.has(origin)) {
      return origin;
    }
    return false;
  },
  credentials: true,
});
```

| Среда | Рекомендация |
| --- | --- |
| Локально | Безаргументный `cors()` или allowlist с `http://localhost:5173` |
| Прод | Не отражать произвольный `Origin`; при `credentials` origin должен быть конкретным |

Отражение по умолчанию в проде открывает API любому сайту — с Cookie ещё опаснее. Если забыть origin док-сайта / Swagger / админки, preflight упадёт на этих доменах.

## Дальше

- Порядок mount и «луковица»: [Middleware](/ru/core/middleware)
- Заголовки безопасности (часто рядом с CORS): [Helmet](/ru/plugins/helmet)
- Наблюдаемость: [HTTP access log](/ru/plugins/http-access-log)
