---
outline: deep
---

# CORS

Чтобы фронт в браузере мог легально вызывать API: в разработке часто разные порты и preflight; в проде сужают разрешённые origin; для Cookie настраивают credentials.

```bash
pnpm add @aomex/cors
```

## До routers

`cors()` пишет заголовки Access-Control-* на этапе middleware, чтобы браузер мог читать кросс-origin тело. Ставьте **перед** `routers`, иначе 4xx/5xx могут остаться без заголовков — preflight пройдёт, а ошибку фронт не прочитает.

```typescript
import { cors } from '@aomex/cors';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'ru-RU' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    cors(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

::: warning
CORS **после** routers может оставить 404 и validation 400 без заголовков — браузер покажет «ошибку CORS» и скроет причину.
:::

Локально при разных портах и **без Cookie** «голый» cors() отражает Origin запроса — обычно хватает. Как только Cookie идут cross-origin ([Session](/ru/plugins/auth-session-strategy)), origin нужно задать явно — см. ниже.

cors() — обычный WebMiddleware, новых полей в ctx нет. При успехе виден Access-Control-Allow-Origin; с Cookie нужны Access-Control-Allow-Credentials: true и **нельзя** `origin: '*'`.

## Сужение Origin и credentials

| Опция | Когда | По умолчанию |
| --- | --- | --- |
| `origin` | Фиксированный фронт в проде или whitelist / функция | Без credentials — отражать `Origin`; **с credentials — обязательно** |
| `credentials` | Cookie / клиентские сертификаты cross-origin | `false` |
| `allowHeaders` | `Authorization`, `x-csrf-token` и т.п. | — |
| `exposeHeaders` | Фронт читает `X-Request-Id` и т.п. | — |
| `maxAge` | Меньше OPTIONS; `-1` без кэша при отладке | `3600` |
| `allowMethods` | Только GET/POST | обычный набор глаголов |
| `secureContext` / `privateNetworkAccess` | Isolated pages, публичный сайт → private API (Chrome PNA) | `false` |

### Cookie-логин: явный origin обязателен

При `credentials: true` (или функция вернула `true`):

- **Нужно** явно задать `origin` (конкретный домен, массив whitelist или функция с конкретным origin)
- **Нельзя** полагаться на отражение у «голого» cors() — исключение при создании или на запросе
- **Нельзя** `origin: '*'` (браузеры тоже отвергают эту пару)

```typescript
cors({
  origin: 'https://app.example.com', // [!code highlight]
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
  exposeHeaders: ['X-Request-Id'],
});
```

::: warning
Credentials без явного origin или с `*` — приложение не стартует или падает на запросе. Так намеренно блокируется опасный дефолт «отражать любой Origin + Cookie».
:::

Для Session добавьте [CSRF](/ru/plugins/csrf), а на фронте — `credentials: 'include'`. Полный путь: [стратегия Session](/ru/plugins/auth-session-strategy).

### Несколько фронтов: whitelist

```typescript
const allowlist = [
  'https://app.example.com',
  'https://admin.example.com',
];

cors({
  origin: allowlist, // [!code highlight]
  credentials: true,
  allowHeaders: ['Content-Type', 'x-csrf-token'],
});
```

Или функция, возвращающая конкретный origin (только при попадании в список; иначе `undefined` — CORS выключен для запроса):

```typescript
cors({
  origin: (ctx) => {
    const origin = ctx.request.headers['origin'];
    if (typeof origin === 'string' && allowlist.includes(origin)) {
      return origin;
    }
    return undefined;
  },
  credentials: true,
});
```

| Среда | Рекомендация |
| --- | --- |
| Локально (без Cookie) | «Голый» `cors()` |
| Локально (Session) | `origin: 'http://localhost:5173'` + `credentials: true` |
| Прод | Явный домен или whitelist; с credentials без дефолтного отражения |

Если поправить только Web API и забыть origin доков / Swagger / админки — preflight на этих доменах упадёт.

## Дальше

- Цепочка Cookie-логина: [стратегия Session](/ru/plugins/auth-session-strategy)
- Защита записей: [CSRF](/ru/plugins/csrf)
- Порядок mount и onion: [Middleware](/ru/core/middleware)
- Security-заголовки (часто рядом с CORS): [Helmet](/ru/plugins/helmet)
- Наблюдаемость: [HTTP access log](/ru/plugins/http-access-log)
