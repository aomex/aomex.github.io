---
outline: deep
---

# Кросс-домен CORS

Позволяет странице фронта в браузере легально ходить в ваше API: в разработке разные порты проходят preflight; в проде сужают «какие origin разрешены», а при Cookie ещё настраивают credentials.

```bash
pnpm add @aomex/cors
```

## До routers

`cors()` на этапе middleware пишет заголовки Access-Control-* в ответ, чтобы браузер разрешил читать тело ответа с другого origin. Ставьте **перед** `routers`, иначе заголовки будут не на всех ответах (включая 4xx/5xx): preflight пройдёт, а при бизнес-ошибке фронт не увидит тело ошибки.

```typescript
import { cors } from '@aomex/cors';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    cors(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

::: warning
Если CORS висит **после** routers, у 404 и валидационных 400 может не быть заголовков — браузер сообщит «CORS», и настоящая причина скроется.
:::

Локально фронт и API на разных портах и **без Cookie** — безаргументный `cors()` отражает Origin из запроса и обычно хватает. Как только нужен кросс-доменный Cookie ([Session](/ru/plugins/auth-session-strategy)), origin нужно задать явно — см. следующий раздел.

`cors()` возвращает обычный WebMiddleware и не вешает новые поля на ctx; в business action пишете как обычно, кросс-домен решается заголовками. При успехе в браузере видно Access-Control-Allow-Origin; со сценарием Cookie ещё нужен Access-Control-Allow-Credentials: true, и **нельзя** `origin: '*'`.

## Cookie-вход: origin обязателен явно

При `credentials: true` (или функция возвращает `true`):

- **Обязательно** явно задать `origin` (конкретный домен, массив allowlist или функция, возвращающая конкретный источник)
- **Нельзя** полагаться на дефолтное отражение безаргументного cors() — без настройки упадёт на старте или при запросе
- **Нельзя** `origin: '*'` (браузер такую пару тоже не примет)

Если фронт ещё шлёт `Authorization`, `x-csrf-token`, пропустите их через `allowHeaders`; чтобы скрипт фронта читал кастомные заголовки вроде `X-Request-Id`, используйте `exposeHeaders`.

```typescript
cors({
  origin: 'https://app.example.com', // [!code highlight]
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
  exposeHeaders: ['X-Request-Id'],
});
```

::: warning
Включили credentials, но не указали origin или написали `*` — приложение не стартует или падает на запросе. Так намеренно блокируется опасный дефолт «отражать любой Origin + Cookie».
:::

Для Session ещё нужен [CSRF](/ru/plugins/csrf), а фронтовый `fetch` — с `credentials: 'include'`. Полная цепочка: [стратегия Session](/ru/plugins/auth-session-strategy).

## Allowlist нескольких фронтов

Если App и админка на разных доменах, `origin` можно передать массивом; заголовок пишется только при совпадении, иначе CORS как будто выключен.

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

Можно функцией вернуть конкретный origin по запросу (только при попадании в allowlist; `undefined` — CORS не включать):

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

Кеш preflight по умолчанию около часа (`maxAge: 3600`); локально можно `-1`, чтобы каждый OPTIONS шёл заново. Если открываете только GET/POST, сузьте через `allowMethods`. `secureContext` / `privateNetworkAccess` нужны только для изоляции страниц / публичных страниц к внутреннему API (Chrome PNA).

| Среда | Рекомендация |
| --- | --- |
| Локально (без Cookie) | безаргументный `cors()` |
| Локально (Session) | `origin: 'http://localhost:5173'` + `credentials: true` |
| Прод | явный домен или allowlist; с credentials никогда не используйте дефолтное отражение |

Если поправили только Web API и забыли origin док-сайта / Swagger / админки, preflight на этих доменах упадёт.

## Дальше

- Вся цепочка Cookie-входа: [стратегия Session](/ru/plugins/auth-session-strategy)
- Защита запросов записи от подделки: [CSRF](/ru/plugins/csrf)
- Порядок монтирования и onion-модель: [Middleware](/ru/core/middleware)
- Security-заголовки (часто рядом с CORS): [Helmet](/ru/plugins/helmet)
- Наблюдаемость на всём сайте: [HTTP access log](/ru/plugins/access-log)
