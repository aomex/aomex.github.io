---
outline: deep
---

# Стратегия JWT

Когда нужен «самодостаточный» токен: шлюз или сервис проверяет подпись локально, меньше ходов в Redis. Отзыв обычно через короткий TTL, refresh или чёрный список; пароль в payload не кладите. Если нужно в любой момент гасить любую сессию на сервере, [Bearer + хранение сессии](/ru/plugins/auth-bearer-strategy) часто удобнее.

Поставьте `@aomex/auth-jwt-strategy`, настройте секрет и `onVerified`; на Router — `authenticate('jwt')`, в бизнесе читайте `ctx.auth.jwt` (это возврат `onVerified`, не форма `{ token, data }`).

## Установка

```bash
pnpm add @aomex/auth
pnpm add @aomex/auth-jwt-strategy
```

## secret и onVerified

```typescript
import { Auth } from '@aomex/auth';
import { AuthJwtStrategy } from '@aomex/auth-jwt-strategy';
import { Router } from '@aomex/web';

const auth = new Auth({
  strategies: {
    jwt: new AuthJwtStrategy({
      secret: process.env.JWT_SECRET!,
      onVerified: (payload) => { // [!code highlight]
        return {
          userId: String(payload.sub),
          roles: (payload.roles as string[]) ?? [],
        };
      },
      onAuthorize(level: number) {
        const identity = this.getIdentity();
        return identity.roles.includes('admin') || level <= 1;
      },
    }),
  },
});

export const router = new Router({
  mount: [auth.authenticate('jwt')],
});

router.get('/me', {
  mount: [auth.authorize('jwt', 1)],
  action: async (ctx) => {
    ctx.send({ userId: ctx.auth.jwt.userId });
  },
});
```

При логине или обновлении выдавайте в action:

```typescript
const token = auth.strategy('jwt').signature(
  { sub: user.id, roles: user.roles },
  { expiresIn: '7d' },
);
```

## Форма ctx.auth и отличие от Bearer

| Стратегия | Примерная форма `ctx.auth[name]` |
| --- | --- |
| Bearer | `{ token, data }` |
| JWT | сам объект, возвращённый `onVerified` |

Поэтому на JWT-маршрутах обычно `ctx.auth.jwt.userId`, а не `ctx.auth.jwt.data.userId`. Не смешивайте форму ctx.auth с Bearer — при смене стратегии меняйте путь чтения в бизнесе.

Тип аргументов `authorize('jwt', level)` следует за определением `onAuthorize`.

::: warning
Не кладите пароль и прочие чувствительные поля в JWT payload: нагрузку можно декодировать и прочитать — только идентификаторы и роли.
:::

## Жёстче проверка подписи и отзыв

В проде часто фиксируют алгоритм и audience, чтобы не принимать неожиданные алгоритмы. В `onVerified` смотрите чёрный список: попадание → `false` → **401**. Token по умолчанию из `Authorization` Bearer; cookie/query как у Bearer — через `tokenLoaders`.

```typescript
new AuthJwtStrategy({
  secret: process.env.JWT_SECRET!,
  verifyOptions: { algorithms: ['HS256'], audience: 'api' }, // [!code highlight]
  onVerified: (payload) => {
    if (isRevoked(payload.jti)) {
      return false;
    }
    return {
      userId: String(payload.sub),
      roles: (payload.roles as string[]) ?? [],
    };
  },
});
```

Ограничение админ-интерфейсов по роли — всё ещё `onAuthorize`, в методе экземпляра `this.getIdentity()`. Асимметричные ключи, ротация старых ключей — в [Продвинутое: своя стратегия аутентификации](/ru/advanced/auth-strategy).

При сбое проверки подписи сначала подумайте о синхронизации часов сервера. Серебряной пули отзыва нет: короткий `expiresIn` + refresh — частая связка; чёрный список ведёте сами.

## Связанное

- [Аутентификация](/ru/plugins/auth)
- [Стратегия Bearer](/ru/plugins/auth-bearer-strategy)
- [Генерация OpenAPI](/ru/openapi/)
