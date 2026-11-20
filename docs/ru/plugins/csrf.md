---
outline: deep
---

# Защита CSRF

Браузер сам прикрепляет same-site Cookie. Если страница злоумышленника заставит ваш браузер сделать POST к API, **HttpOnly Cookie входа уедет вместе с запросом** — это CSRF. `@aomex/csrf` использует **double-submit Cookie**: сервер выдаёт читаемый Cookie `csrfToken`, фронт кладёт то же значение в заголовок; запись проходит только при совпадении.

Почти всегда в паре с [Session](/ru/plugins/auth-session-strategy). Если вход только через Bearer и без Cookie-сессии, CSRF обычно не нужен.

```bash
pnpm add @aomex/csrf
```

## До routers

Достаточно `csrf()` без аргументов: GET/HEAD/OPTIONS только выдают или переиспользуют Cookie без проверки заголовка; POST и другие записи требуют совпадения Cookie и `x-csrf-token`, иначе **403**.

```typescript
import { cors } from '@aomex/cors';
import { csrf } from '@aomex/csrf';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'ru-RU' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:5]
    cors({ origin: 'https://app.example.com', credentials: true }),
    csrf(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

::: warning
Ставьте **перед** routers. Если csrf после error-middleware, свежий `Set-Cookie` может не дойти до браузера — фронт навсегда без token.
:::

Middleware пишет в ctx `csrfToken` (текущая строка). Cookie **принудительно** `httpOnly: false` (JS должен читать); остальные атрибуты (`sameSite` / `path` / `maxAge`) настраиваются, по умолчанию как у `setCookie` (включая `SameSite=Strict`).

Если login Cookie тоже идёт cross-origin: CORS с `credentials: true` и **явным** `origin`, в `allowHeaders` — `x-csrf-token`. См. [CORS](/ru/plugins/cors) и [Session](/ru/plugins/auth-session-strategy).

## Что шлёт фронт

1. Любой GET (или открытие страницы) → в ответе `Set-Cookie: csrfToken=...`
2. Прочитать значение из `document.cookie` (или своего helper)
3. На записи заголовок `x-csrf-token: <то же значение>` и `credentials: 'include'`, если нужен login Cookie

```typescript
function readCsrfToken() {
  const row = document.cookie
    .split('; ')
    .find((line) => line.startsWith('csrfToken='));
  return row?.slice('csrfToken='.length);
}

await fetch('/api/orders', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': readCsrfToken()!, // [!code highlight]
  },
  body: JSON.stringify({ sku: 'A1' }),
});
```

Первый POST без Cookie даст **403**, но в ответе может быть новый `Set-Cookie` — прочитайте и повторите.

## Опции и пропуски

| Опция | Когда | По умолчанию |
| --- | --- | --- |
| `cookie.name` | Согласовать с фронтом | `csrfToken` |
| `cookie.sameSite` / `path` / `maxAge` / `secure` | Cross-site, path, срок | Как у `setCookie`; `httpOnly` всегда `false` |
| `headerName` | Фронт уже использует другое имя | `x-csrf-token` |
| `ignoreMethods` | Методы без проверки | `GET`, `HEAD`, `OPTIONS` |
| `ignore` | Health-check, внешние webhook по запросу | — |

```typescript
csrf({
  cookie: { sameSite: 'lax', maxAge: 86400 },
  headerName: 'x-xsrf-token',
  ignore: (ctx) => {
    return ctx.request.pathname.startsWith('/webhooks/');
  },
});
```

Читает только Header + Cookie — **не body**, не мешает `body()`. Для webhook без браузера — `ignore`, не отключайте CSRF глобально.

## Связанное

- [Стратегия Session](/ru/plugins/auth-session-strategy)
- [CORS](/ru/plugins/cors)
- [Helmet](/ru/plugins/helmet)
