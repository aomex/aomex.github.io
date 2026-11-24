---
outline: deep
---

# Стратегия Bearer

Самый частый фронтовый приём: `Authorization: Bearer <token>`. Сервер меняет непрозрачный token на объект пользователя; неудача — **401**. Локальная проверка подписи и меньше ходов в БД — см. [стратегию JWT](/ru/plugins/auth-jwt-strategy), но отзыв и смена прав обычно требуют отдельной работы.

Настройте AuthBearerStrategy: достаньте token из запроса, в `onLoaded` превратите в бизнес-личность; роли сравнивайте в `onAuthorize`; в бизнесе читайте `ctx.auth.bearer.data`, не сырую строку token.

## Установка

Bearer идёт с основным пакетом `@aomex/auth`, импорт с подпути.

```bash
pnpm add @aomex/auth
```

```typescript
import { AuthBearerStrategy } from '@aomex/auth/bearer';
```

## onLoaded и монтирование на Router

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

На маршруте логина (без authenticate) выдайте token:

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

`signature` даёт **непрозрачную** случайную строку (можно подмешать бизнес-ключ для изоляции доменов), это **не** JWT. На сам маршрут логина authenticate не вешайте.

После успешной аутентификации:

```typescript
ctx.auth.bearer // { token: string; data: T }
```

`T` — форма объекта, который `onLoaded` вернул при успехе. Тип `n` в `authorize('bearer', n)` следует за вашим `onAuthorize`.

`onAuthorize` можно методом экземпляра (`this.getIdentity()`) или каррированием — на выбор, типы пойдут за определением стратегии:

```typescript
onAuthorize: (minRole: number) => {
  return (identity) => {
    return identity.role >= minRole;
  };
},
```

## Token из нескольких источников

`onLoaded` обязателен: Redis/DB меняет token на пользователя, `false` → **401**. По умолчанию только `Authorization` Bearer (предпочтительно в проде); если встроенная страница не может слать заголовок — добавьте query / cookie / body; query и body легко попадают в access log и Referer — по возможности избегайте. Если нужна только сессия без ролей, `onAuthorize` можно опустить.

Типичные `tokenLoaders`:

- `{ type: 'header', key: 'authorization' }` — только двухчастная форма `Bearer <token>`; голый token сюда не кладите
- `{ type: 'body' | 'query' | 'cookie', key: 'access_token' }` — компромисс, когда заголовок нельзя

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

При генерации OpenAPI передайте в `generateOpenapi({ app })` тот же `WebApp` с `auth.authenticate('bearer')` — схема безопасности Bearer появится в доке. Общий вход: [Аутентификация](/ru/plugins/auth).

`onLoaded` → `false` значит «не вошли»; не подменяйте бизнес-исключением, если не нужен свой код ошибки. Самодостаточный JWT — через [стратегию JWT](/ru/plugins/auth-jwt-strategy), не проверяйте JWT как непрозрачную Bearer-строку.

## Связанное

- [Аутентификация](/ru/plugins/auth)
- [Стратегия JWT](/ru/plugins/auth-jwt-strategy)
- [Генерация OpenAPI](/ru/openapi/)
