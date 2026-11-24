---
outline: deep
---

# Защита CSRF

Браузер сам прикрепляет same-site Cookie. Если страница злоумышленника заставит ваш браузер сделать POST к вашему API, **HttpOnly Cookie входа уедет вместе с запросом** — это межсайтовая подделка запроса. `@aomex/csrf` использует **double-submit Cookie**: сервер выдаёт читаемый Cookie `csrfToken`, фронт кладёт то же значение в заголовок; запись проходит только при совпадении обеих сторон.

С [Session](/ru/plugins/auth-session-strategy) почти всегда идёт в паре; если вход только через заголовок Bearer и без Cookie-сессии, CSRF обычно не нужен.

```bash
pnpm add @aomex/csrf
```

## До routers

Достаточно безаргументного `csrf()`: GET/HEAD/OPTIONS только выдают или переиспользуют Cookie, заголовок не проверяют; POST и другие методы записи требуют совпадения Cookie и `x-csrf-token`, иначе **403**.

```typescript
import { cors } from '@aomex/cors';
import { csrf } from '@aomex/csrf';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:5]
    cors({ origin: 'https://app.example.com', credentials: true }),
    csrf(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

::: warning
Ставьте **перед** routers. Если при ошибке сработает error-middleware, а csrf висит после него, свежий `Set-Cookie` может не дойти до браузера — фронт навсегда останется без token.
:::

Промежуточный слой вешает на ctx `csrfToken` (текущая строка token). Cookie **принудительно** `httpOnly: false` (double-submit требует читаемости из JS); остальные атрибуты (`sameSite` / `path` / `maxAge`) настраиваются, по умолчанию как у `setCookie` (включая `SameSite=Strict`).

Если нужен кросс-доменный запрос ещё и с Cookie входа, CORS должен иметь `credentials: true` и **явный** `origin`, а в `allowHeaders` — пропуск `x-csrf-token`. См. [CORS](/ru/plugins/cors) и [Session](/ru/plugins/auth-session-strategy).

## Как передаёт фронт

1. Сначала любой GET (или открытие страницы) — в ответе будет `Set-Cookie: csrfToken=...`
2. Прочитайте значение через `document.cookie` (или ваш cookie-утилитарный код)
3. К запросу записи добавьте заголовок `x-csrf-token: <то же значение>` и `credentials: 'include'` (если ещё нужна Cookie входа)

```typescript
function readCsrfToken() {
  const row = document.cookie
    .split('; ')
    .find((line) => {
      return line.startsWith('csrfToken=');
    });
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

Если сразу POST на интерфейс без Cookie: будет **403**, но в ответе всё равно может прийти свежий `Set-Cookie` — фронт читает и повторяет запрос.

## Согласование с фронтом

Если фронт уже шлёт `x-xsrf-token` или имя Cookie не `csrfToken`, выровняйте это в конструкторе; `httpOnly` по-прежнему принудительно выключится.

```typescript
csrf({
  cookie: { name: 'XSRF-TOKEN', sameSite: 'lax', maxAge: 86400 }, // [!code highlight]
  headerName: 'x-xsrf-token',
});
```

`sameSite` / `path` / `secure` / `maxAge` следуют политике бизнес-Cookie; для кросс-сайтового фронта часто ставят `sameSite: 'lax'`.

## Пропуск webhook и health-check

Колбэки третьих сторон и пробы балансировщика не имеют браузерных Cookie и не должны идти через double-submit. Пропускайте пути через `ignore`; не отключайте CSRF глобально.

```typescript
csrf({
  ignore: (ctx) => { // [!code focus:3]
    return ctx.request.pathname.startsWith('/webhooks/');
  },
});
```

Читаются только Header + Cookie, **body не трогается**, с разбором `body()` не конфликтует. По умолчанию не проверяются GET / HEAD / OPTIONS; менять `ignoreMethods` почти никогда не нужно.

## Связанное

- [Стратегия Session](/ru/plugins/auth-session-strategy)
- [Кросс-домен CORS](/ru/plugins/cors)
- [Заголовки безопасности Helmet](/ru/plugins/helmet)
