---
outline: deep
---

# Стратегия JWT

Самодостаточные token: проверка на шлюзе или в сервисе, меньше Redis. Отзыв — короткий TTL, refresh, blocklist; пароли в payload не кладите. Если нужно отозвать любую сессию на сервере в любой момент, проще [Bearer + хранилище сессий](/ru/plugins/auth-bearer-strategy).

Установите `@aomex/auth-jwt-strategy`, secret и `onVerified`; `authenticate('jwt')` на Router; в коде `ctx.auth.jwt` (возврат `onVerified`, не `{ token, data }`).

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

Подпись при login или refresh в action:

```typescript
const token = auth.strategy('jwt').signature(
  { sub: user.id, roles: user.roles },
  { expiresIn: '7d' },
);
```

## Форма ctx.auth vs Bearer

| Стратегия | Примерно `ctx.auth[name]` |
| --- | --- |
| Bearer | `{ token, data }` |
| JWT | сам объект из `onVerified` |

На JWT-маршрутах `ctx.auth.jwt.userId`, не `ctx.auth.jwt.data.userId`. При миграции стратегий держите это в голове.

`authorize('jwt', level)` следует `onAuthorize`.

::: warning
Пароли и секреты не в payload JWT — claims читаемы; только идентификаторы и роли.
:::

## verifyOptions и отзыв

| Опция | Когда использовать |
| --- | --- |
| `secret` | Симметричный ключ; монолит / внутреннее |
| `tokenLoaders` | По умолчанию Bearer в `Authorization`; cookie/query как у Bearer |
| `verifyOptions` | Алгоритмы, `audience` / `issuer` |
| `onVerified` | Payload → идентичность; blocklist → `false` → 401 |
| `onAuthorize` | Админ по роли; `this.getIdentity()` в методах экземпляра |

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

Асимметричные ключи и ротация: [Своя стратегия auth](/ru/advanced/auth-strategy).

При провале проверки смотрите рассинхрон часов. Универсального отзыва нет — короткий `expiresIn` + refresh; blocklist — DIY.

## Связанное

- [Аутентификация](/ru/plugins/auth)
- [Bearer](/ru/plugins/auth-bearer-strategy)
- [Генерация OpenAPI](/ru/plugins/openapi)
