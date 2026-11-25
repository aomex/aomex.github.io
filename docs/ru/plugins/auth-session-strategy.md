---
outline: deep
---

# Стратегия Session

Состояние входа в браузере лежит в **HttpOnly Cookie**: в Cookie только непрозрачный `sessionId`, данные пользователя — в адаптере `@aomex/cache` (memory / Redis). Для кросс-доменного SPA нужны и [CORS](/ru/plugins/cors) (с Cookie), и [CSRF](/ru/plugins/csrf) (против кросс-сайтовой записи) — без куска либо сессия не доедет, либо чужой сайт сможет ею злоупотребить.

Подходит для «свой или доверенный фронт + сессию можно гасить на сервере в любой момент»; чисто мобильные / машинные вызовы чаще идут через [Bearer](/ru/plugins/auth-bearer-strategy) или [JWT](/ru/plugins/auth-jwt-strategy).

## Установка

Стратегия Session идёт с основным `@aomex/auth`; для хранения сессии ещё `@aomex/cache` (и Redis-адаптер в проде). Для кросс-доменных Cookie — CORS / CSRF.

```bash
pnpm add @aomex/auth @aomex/cache
# 跨域 Cookie：pnpm add @aomex/cors @aomex/csrf
# 多实例共享会话：pnpm add @aomex/cache-redis-adapter
```

```typescript
import { AuthSessionStrategy } from '@aomex/auth/session';
```

## Сначала CORS и CSRF

Кросс-доменный фронт с Cookie требует от браузера:

1. Запрос с `credentials: 'include'` (или XHR `withCredentials`)
2. В ответе `Access-Control-Allow-Credentials: true` и `Access-Control-Allow-Origin` — **конкретный домен** (не `*`)
3. Запросы записи с CSRF-заголовком, иначе чужая страница «одолжит» ваш Cookie для POST

При `credentials: true` **обязателен явный `origin`**, нельзя полагаться на дефолтное отражение безаргументного cors() — упадёт уже на старте. CSRF — double-submit Cookie: читаемый Cookie `csrfToken` совпадает с заголовком `x-csrf-token`.

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
  mount: [ // [!code focus:8]
    cors({
      origin: 'https://app.example.com',
      credentials: true,
      allowHeaders: ['Content-Type', 'x-csrf-token'],
    }),
    csrf(),
    routers('./src/routers'),
  ],
});
```

::: tip
Локально на разных портах поставьте origin `http://localhost:5173` (или адрес вашего фронта), не `*`. Same-origin деплой (фронт и API один origin) может обойтись без cors(), но CSRF лучше оставить.
:::

Порядок: cors → csrf → routers. Оба **перед** routers, иначе ошибочные ответы не получат CORS / свежий CSRF Cookie.

Типичный запрос изменения данных с фронта:

```typescript
const csrfToken = document.cookie
  .split('; ')
  .find((row) => row.startsWith('csrfToken='))
  ?.split('=')[1];

await fetch('https://api.example.com/api/posts', {
  method: 'POST',
  credentials: 'include', // [!code highlight]
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken!, // [!code highlight]
  },
  body: JSON.stringify({ title: 'hi' }),
});
```

Безопасные методы вроде GET по умолчанию CSRF не проверяют; при первом визите выдаётся Cookie `csrfToken` (`HttpOnly=false`, JS может читать). Детали: [CSRF](/ru/plugins/csrf).

## store, cookie и onLoaded

`cookie.maxAge` (секунды) обязателен и одновременно TTL кеша. `onLoaded` превращает Stored из cache в бизнес-личность; уже вышедший пользователь — `false` → **401**.

```typescript
import { Auth } from '@aomex/auth';
import { AuthSessionStrategy } from '@aomex/auth/session';
import { Caching } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import { body, Router } from '@aomex/web';
import { rule } from '@aomex/common';

const cache = new Caching(new CacheMemoryAdapter());

const auth = new Auth({
  strategies: {
    session: new AuthSessionStrategy({
      store: cache, // [!code highlight]
      cookie: {
        maxAge: 7 * 24 * 3600,
        // 生产跨站前端常见：sameSite: 'none', secure: true
      },
      onLoaded: async (data: { userId: number }) => {
        const user = await findActiveUser(data.userId);
        return user ?? false;
      },
      onAuthorize(minRole: number) {
        return this.getIdentity().role >= minRole;
      },
    }),
  },
});
```

В проде или на нескольких инстансах — внешний адаптер вроде Redis, см. [Кеш](/ru/core/cache). Имя Cookie по умолчанию `sessionId`; у `setCookie` по умолчанию `httpOnly: true`, `sameSite: Strict` (кросс-сайт фронту нужен `'none'` и `secure`). `cookie.name` / `path` / `domain` выровняйте с доменом фронта.

Чтобы активных пользователей реже выкидывало — `sliding`: при каждой успешной аутентификации продлевается TTL + Cookie. Свой префикс ключа кеша — `generateCacheKey` (по умолчанию `auth:session:${sessionId}`). `onAuthorize` пишите, когда нужен `authorize(роль)`.

## Логин, аутентификация, выход

На маршрут логина **не** вешайте `authenticate`. `strategy.login(ctx, stored)` пишет кеш и ставит Cookie (новый `sessionId`; если в запросе уже был старый Cookie, после успешной записи старая сессия удаляется). На приватные интерфейсы — `authenticate('session')`, читайте `ctx.auth.session`.

```typescript
const session = auth.strategy('session');

export const publicRouter = new Router({ prefix: '/api' });

publicRouter.post('/login', { // [!code focus:12]
  mount: [body({ email: rule.email(), password: rule.string() })],
  action: async (ctx) => {
    const user = await verifyPassword(ctx.body);
    if (!user) {
      return ctx.throw(401, 'invalid credentials');
    }

    await session.login(ctx, { userId: user.id }); // [!code highlight]
    ctx.send({ ok: true });
  },
});

publicRouter.post('/logout', {
  action: async (ctx) => {
    await session.logout(ctx);
    ctx.send(204, null);
  },
});

export const privateRouter = new Router({
  prefix: '/api',
  mount: [auth.authenticate('session')],
});

privateRouter.get('/me', {
  action: async (ctx) => {
    ctx.send(ctx.auth.session.data); // [!code highlight]
  },
});
```

После успеха:

```typescript
ctx.auth.session // { sessionId: string; data: Loaded }
```

`data` — возврат `onLoaded`. `logout` чистит кеш и Cookie; `touch` только продлевает, не меняя содержимое. После повышения прав или чувствительной операции смените id через `regenerateSessionId(ctx)` (можно сразу передать новый Stored).

::: warning
При кросс-домене фронт обязан `credentials: 'include'`, иначе браузер не приложит Cookie `sessionId` — выглядит как «логин успешен, сразу 401».
:::

## Выбор между Bearer / JWT

| | Session | Bearer / JWT |
| --- | --- | --- |
| Где учётные данные | HttpOnly Cookie | заголовок / локальное хранилище |
| Кросс-домен | CORS credentials + часто CSRF | обычно только `Authorization` |
| Отзыв | удалить кеш | Bearer — удалить сессию; JWT — короткий TTL / чёрный список |
| Типичный клиент | браузерный SPA / админка | App, открытая платформа, сервис–сервис |

Same-origin админка — предпочтительно Session; открытое API — Bearer или JWT. Общий вход: [Аутентификация](/ru/plugins/auth).

## Связанное

- [Кросс-домен CORS](/ru/plugins/cors)
- [CSRF](/ru/plugins/csrf)
- [Аутентификация](/ru/plugins/auth)
- [Кеш](/ru/core/cache)
- [Стратегия Bearer](/ru/plugins/auth-bearer-strategy)
