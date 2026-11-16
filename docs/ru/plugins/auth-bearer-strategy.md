---
outline: deep
---

# Стратегия Bearer

Типичный фронт: `Authorization: Bearer <token>`. Сервер меняет непрозрачный token на объект пользователя; провал → **401**. Локальная проверка и меньше БД — [JWT](/ru/plugins/auth-jwt-strategy); отзыв и смена прав требуют доп. работы.

Настройте `AuthBearerStrategy`: извлечь token, идентичность в `onLoaded`; роли в `onAuthorize`; в коде `ctx.auth.bearer.data`, не сырая строка token.

## Установка

Bearer в основном пакете `@aomex/auth` — subpath import.

```bash
pnpm add @aomex/auth
```

```typescript
import { AuthBearerStrategy } from '@aomex/auth/bearer';
```

## onLoaded и mount на Router

```typescript
import { Auth } from '@aomex/auth';
import { AuthBearerStrategy } from '@aomex/auth/bearer';
import { Router } from '@aomex/web';

const auth = new Auth({
  strategies: {
    bearer: new AuthBearerStrategy({
      onLoaded: async (token, ctx) => {
        const row = await db.tokens.find(token);
        if (!row) {
          return false;
        }
        return { userId: row.userId, role: row.role };
      },
      onAuthorize(minRole: number) {
        return this.getIdentity().role >= minRole;
      },
    }),
  },
});

const router = new Router({ // [!code focus:10]
  mount: [auth.authenticate('bearer')], // [!code highlight]
});

router.get('/me', {
  action: async (ctx) => {
    ctx.send(ctx.auth.bearer.data);
  },
});

router.delete('/posts/:id', {
  mount: [auth.authenticate('bearer').authorize(10)],
  action: async (ctx) => {
    ctx.send(204, null);
  },
});
```

Выдача token при login (без authenticate):

```typescript
router.post('/login', { // [!code focus:13]
  mount: [body({ email: rule.email(), password: rule.string() })],
  action: async (ctx) => {
    const user = await verifyPassword(ctx.body);
    if (!user) {
      return ctx.throw(401, 'invalid credentials');
    }

    const token = auth.strategy('bearer').signature('sha256', user.id); // [!code highlight]
    await saveSession(token, { userId: user.id, role: user.role });
    ctx.send({ token });
  },
});
```

`signature` — **непрозрачная** случайная строка (опциональный бизнес-ключ) — **не** JWT. Login-маршруты без `authenticate`.

После успеха:

```typescript
ctx.auth.bearer // { token: string; data: T }
```

`T` — возврат `onLoaded`. `authorize('bearer', n)` следует вашему `onAuthorize`.

`onAuthorize` — метод экземпляра (`this.getIdentity()`) или каррирование; типы из определения стратегии:

```typescript
onAuthorize: (minRole: number) => {
  return (identity) => {
    return identity.role >= minRole;
  };
},
```

## tokenLoaders и onLoaded

| Опция | Когда использовать | По умолчанию |
| --- | --- | --- |
| `onLoaded` | Поиск в Redis/БД; `false` если нет | **обязательно** |
| `tokenLoaders` | По умолчанию `Authorization`; cookie/query для embed | header Bearer (предпочтительно) |
| `onAuthorize` | При `authorize(role)`; только login — можно не задавать | опционально |

Формы `tokenLoaders`:

- `{ type: 'header', key: 'authorization' }` — только `Bearer <token>` в двух частях
- `{ type: 'body' | 'query' | 'cookie', key: 'access_token' }` — когда header невозможен

```typescript
new AuthBearerStrategy({
  tokenLoaders: [ // [!code highlight]
    { type: 'header', key: 'authorization' },
    { type: 'query', key: 'access_token' },
  ],
  onLoaded: async (token) => {
    const session = await cache.getSession(token);
    return session || false;
  },
});
```

В OpenAPI передайте в `generateOpenapi({ app })` тот же `WebApp` с `auth.authenticate('bearer')`. Обзор: [Аутентификация](/ru/plugins/auth).

`onLoaded` → `false` — неаутентифицирован (**401**); не подменяйте бизнес-исключениями без нужды. Самодостаточный JWT: [JWT](/ru/plugins/auth-jwt-strategy) — не проверяйте JWT как непрозрачный Bearer.

## Связанное

- [Аутентификация](/ru/plugins/auth)
- [JWT](/ru/plugins/auth-jwt-strategy)
- [Генерация OpenAPI](/ru/plugins/openapi)
