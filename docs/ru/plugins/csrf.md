---
outline: deep
---

# Защита от CSRF

Браузер сам подставляет cookie того же сайта. Если страница атакующего заставляет браузер слать POST на ваш API, **HttpOnly cookie входа тоже уедет** — это подделка межсайтового запроса. `@aomex/csrf` использует **double-submit cookie**: сервер выдаёт читаемую cookie `csrfToken`, фронт кладёт то же значение в заголовок запроса; пропускают только совпадающие пары.

Почти всегда в паре с [Session](/ru/plugins/auth-session-strategy). Если вход только по Bearer без cookie — CSRF обычно не нужен.

```bash
pnpm add @aomex/csrf
```

## Перед routers

Достаточно `csrf()` без аргументов: GET/HEAD/OPTIONS лишь выдают или продлевают cookie, заголовок не проверяют; для POST и других «пишущих» методов cookie и `x-csrf-token` должны совпасть, иначе **403**.

```typescript
import { cors } from '@aomex/cors';
import { csrf } from '@aomex/csrf';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
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
Ставьте **перед** routers. При провале проверки ошибка идёт через error middleware; если csrf позади, свежий `Set-Cookie` может не дойти до браузера, и фронт так и останется без token.
:::

Middleware вешает на ctx `csrfToken` (текущая строка token). Для cookie **принудительно** `httpOnly: false` (double-submit требует чтения из JS); остальное (`sameSite` / `path` / `maxAge`) настраивается, по умолчанию как у `setCookie` (в т.ч. `SameSite=Strict`).

При кросс-домене с cookie входа нужны CORS `credentials: true`, **явный** `origin` и `allowHeaders` с `x-csrf-token`. См. [CORS](/ru/plugins/cors) и [Session](/ru/plugins/auth-session-strategy).

## Как передать с фронта

1. Сначала любой GET (или открыть страницу) — в ответе будет `Set-Cookie: csrfToken=...`
2. Прочитать значение через `document.cookie` (или свою утилиту)
3. В «пишущие» запросы добавить заголовок `x-csrf-token: <то же значение>` и `credentials: 'include'` (если ещё нужна cookie входа)

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

Первый POST без cookie — **403**, но ответ может всё равно принести новый `Set-Cookie`; прочитайте и повторите.

## Под договорённости фронта

Если фронт шлёт `x-xsrf-token` или cookie называется иначе `csrfToken` — задайте в опциях конструктора; `httpOnly` по-прежнему принудительно выключен.

```typescript
csrf({
  cookie: { name: 'XSRF-TOKEN', sameSite: 'lax', maxAge: 86400 }, // [!code highlight]
  headerName: 'x-xsrf-token',
});
```

`sameSite` / `path` / `secure` / `maxAge` — по политике cookie продукта; для кросс-сайтового фронта часто ставят `lax`.

## Пропуск webhook и health

У колбэков и probe балансировщика нет браузерных cookie, double-submit не нужен. `ignore` по пути; CSRF глобально не выключайте.

```typescript
csrf({
  ignore: (ctx) => { // [!code focus:3]
    return ctx.request.pathname.startsWith('/webhooks/');
  },
});
```

Смотрит только заголовки и cookie, **body не читает** — не мешает `body()`. По умолчанию без проверки: GET / HEAD / OPTIONS; менять `ignoreMethods` редко нужно.

## См. также

- [Session](/ru/plugins/auth-session-strategy)
- [CORS](/ru/plugins/cors)
- [Helmet](/ru/plugins/helmet)