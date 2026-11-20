---
outline: deep
---

# Стратегия Session

Состояние входа браузера хранится в **HttpOnly Cookie**: в Cookie только непрозрачный `sessionId`, данные пользователя — в адаптере `@aomex/cache` (memory / Redis). Для SPA на другом origin нужны и [CORS](/ru/plugins/cors) (передача Cookie), и [CSRF](/ru/plugins/csrf) (защита от кросс-сайтовой записи) — без любого из них сессия либо не доезжает, либо её легко злоупотребить с чужой страницы.

Подходит для «тот же origin или доверенный фронт + отзыв сессии на сервере в любой момент». Для чистых мобильных клиентов и machine-to-machine чаще [Bearer](/ru/plugins/auth-bearer-strategy) или [JWT](/ru/plugins/auth-jwt-strategy).

## Установка

Стратегия Session входит в `@aomex/auth`; для хранения сессий нужен `@aomex/cache` (и Redis-адаптер в проде). Для Cookie через CORS добавьте CORS / CSRF.

```bash
pnpm add @aomex/auth @aomex/cache
# Cookie через cross-origin: pnpm add @aomex/cors @aomex/csrf
# Общая сессия на нескольких инстансах: pnpm add @aomex/cache-redis-adapter
```

```typescript
import { AuthSessionStrategy } from '@aomex/auth/session';
```

## Сначала CORS и CSRF

Когда фронт на другом origin шлёт Cookie, браузер требует:

1. Запрос с `credentials: 'include'` (или XHR `withCredentials`)
2. Ответ с `Access-Control-Allow-Credentials: true` и **конкретным** `Access-Control-Allow-Origin` (не `*`)
3. CSRF-заголовок на записях — иначе чужая страница может «одолжить» ваш Cookie для POST

При `credentials: true` **нужно явно задать `origin`** — нельзя полагаться на отражение у «голого» `cors()`: исключение уже при старте. CSRF — double-submit Cookie: читаемый Cookie `csrfToken` должен совпадать с заголовком `x-csrf-token`.

```typescript
import { cors } from '@aomex/cors';
import { csrf } from '@aomex/csrf';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'ru-RU' },
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
Локально при разных портах укажите origin `http://localhost:5173` (или URL фронта), не `*`. При том же origin cors() можно опустить, CSRF лучше оставить.
:::

Порядок: cors → csrf → routers. Оба **до** routers, иначе ошибки останутся без CORS / только что выданного CSRF Cookie.

Пример мутирующего запроса с фронта:

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

Безопасные методы вроде GET по умолчанию CSRF не проверяют; первый визит выдаёт Cookie `csrfToken` (`HttpOnly=false`, JS может прочитать). Подробности: [CSRF](/ru/plugins/csrf).

## store, cookie и onLoaded

`cookie.maxAge` (секунды) обязателен и одновременно TTL кэша. `onLoaded` превращает Stored из cache в бизнес-идентичность; для отозванного пользователя верните `false` → **401**.

```typescript
import { Auth } from '@aomex/auth';
import { AuthSessionStrategy } from '@aomex/auth/session';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import { body, Router } from '@aomex/web';
import { rule } from '@aomex/common';

const auth = new Auth({
  strategies: {
    session: new AuthSessionStrategy({
      store: new CacheMemoryAdapter(), // [!code highlight]
      cookie: {
        maxAge: 7 * 24 * 3600,
        // Для cross-site фронта в проде часто: sameSite: 'none', secure: true
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

В проде и на нескольких инстансах — Redis и т.п.; см. [кэш](/ru/core/cache). Имя Cookie по умолчанию `sessionId`; у `setCookie` по умолчанию `httpOnly: true`, `sameSite: Strict` (для cross-site — `'none'` и `secure`).

| Опция | Когда |
| --- | --- |
| `store` | Где лежат сессии; локально memory, на репликах Redis |
| `cookie.maxAge` | Срок сессии в секундах; **обязателен** |
| `cookie.name` / `path` / `domain` / `sameSite` / `secure` | Под домен фронта и cross-site |
| `sliding` | Продлевать TTL + Cookie при каждой успешной auth |
| `generateCacheKey` | Свой префикс ключа; по умолчанию `auth:session:${sessionId}` |
| `onLoaded` | Stored → идентичность; БД / отзыв |
| `onAuthorize` | Только если нужен `authorize(роль)` |

## Вход, проверка, выход

На маршрут логина **не** вешайте `authenticate`. `strategy.login(ctx, stored)` пишет кэш и ставит Cookie (новый `sessionId`; если в запросе был старый Cookie, после успешной записи старая сессия удаляется). Защищённые API — `authenticate('session')`, чтение — `ctx.auth.session`.

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

После успешной auth:

```typescript
ctx.auth.session // { sessionId: string; data: Loaded }
```

`data` — результат `onLoaded`. `logout` удаляет кэш и Cookie; `touch` только продлевает TTL. После повышения прав или чувствительного действия вызовите `regenerateSessionId(ctx)` (можно передать новый Stored).

::: warning
На cross-origin фронт обязан слать `credentials: 'include'`, иначе браузер не приложит Cookie `sessionId` — «логин прошёл, сразу 401».
:::

## Session vs Bearer / JWT

| | Session | Bearer / JWT |
| --- | --- | --- |
| Где credential | HttpOnly Cookie | Заголовок / local storage |
| Cross-origin | CORS credentials + часто CSRF | Обычно только `Authorization` |
| Отзыв | Удалить запись в кэше | Bearer — удалить сессию; JWT — короткий TTL / denylist |
| Типичный клиент | Браузерный SPA / админка | App, open platform, service-to-service |

Админка на том же origin — скорее Session; публичное API — Bearer или JWT. Обзор: [Аутентификация](/ru/plugins/auth).

## Связанное

- [CORS](/ru/plugins/cors)
- [CSRF](/ru/plugins/csrf)
- [Аутентификация](/ru/plugins/auth)
- [Кэш](/ru/core/cache)
- [Bearer](/ru/plugins/auth-bearer-strategy)
