---
outline: deep
---

# Кастомные стратегии аутентификации

[Bearer](/ru/plugins/auth-bearer-strategy), [API Key](/ru/plugins/auth-api-key-strategy), [JWT](/ru/plugins/auth-jwt-strategy) и [Session](/ru/plugins/auth-session-strategy) уже закрывают обычные способы взять credentials. Эта страница — когда готовые стратегии не подходят, но нужно:

- один путь через `auth.authenticate` / `authorize`  
- **401** без входа, **403** без прав  
- `ctx.auth.<имяСтратегии>.data` в хендлерах  
- соответствующий security в OpenAPI  

Типичные случаи: заголовки от шлюза, личность из mTLS, своя подпись. Cookie Session — через [Session-стратегию](/ru/plugins/auth-session-strategy), здесь её не переписывайте. Если нужен только `user` на `ctx` без соглашений Auth — обычный middleware; security и ветку «не вошёл» закрываете сами.

Ниже — **заголовок шлюза** (например `x-user-id`) от нуля до монтирования на маршруты.

## Шаг 1: Какой вид у личности

Зафиксируйте данные после успешной проверки, например `{ userId: number }`. Это первый дженерик класса стратегии и тип `ctx.auth.gateway.data`.

Второй дженерик — аргументы `authorize`, например роли: `[string]` → потом `.authorize('admin')`.

## Шаг 2: Реализуйте `authenticate` (сбор credentials)

Читайте credentials из запроса; нет / неверно — по контракту ниже. **Не бросайте непойманные исключения** (часто будет 500, клиент решит, что сервис упал).

```typescript
// src/auth/gateway.strategy.ts
import { Strategy, AuthError } from '@aomex/auth';
import type { WebContext } from '@aomex/web';

export class GatewayStrategy extends Strategy<{ userId: number }, [string]> {
  protected async authenticate(ctx: WebContext) {
    const raw = ctx.request.get('x-user-id'); // [!code highlight]
    if (!raw) {
      return false; // → 401 не вошёл
    }
    const userId = Number(raw);
    if (!Number.isFinite(userId) || userId <= 0) {
      return new AuthError('invalid gateway user'); // → 401 с сообщением
    }
    return { userId }; // → в ctx.auth
  }

  protected async authorize(role: string) {
    const identity = this.getIdentity();
    return userHasRole(identity.userId, role);
  }
}
```

Возврат `authenticate`:

| Возврат | Поведение |
| --- | --- |
| Объект личности | Пишется в `ctx.auth`, пайплайн дальше |
| `false` | Не вошёл → **401** |
| `AuthError` | Сбой аутентификации с сообщением → **401** |

Ложь или `AuthError` из `authorize` → **403**. В `authorize` личность — `this.getIdentity()` (объект успешного `authenticate`).

## Шаг 3: Передайте в Auth — ключ и есть имя стратегии

```typescript
// src/auth/index.ts
import { Auth } from '@aomex/auth';
import { GatewayStrategy } from './gateway.strategy';

export const auth = new Auth({
  strategies: {
    gateway: new GatewayStrategy(), // [!code highlight]
  },
});
```

Ключ `gateway` задаёт три вещи:

1. `auth.authenticate('gateway')`  
2. `ctx.auth.gateway`  
3. форму `ctx.auth.gateway.data` (из дженериков стратегии)

## Шаг 4: Повесьте на маршруты и проверьте

**Публичные** и **защищённые** маршруты — в разные `Router` (или `.skip` на цепочке auth — см. [Middleware](/ru/core/middleware)). Не сваливайте всё в одну группу «на глаз».

```typescript
import { Router } from '@aomex/web';
import { auth } from '@/auth';

export const router = new Router({
  prefix: '/admin',
  mount: [auth.authenticate('gateway')], // вся группа требует вход
});

router.get('/dashboard', {
  mount: [auth.authenticate('gateway').authorize('admin')], // [!code highlight]
  action: async (ctx) => {
    const userId = ctx.auth.gateway.data.userId;
    ctx.send({ userId });
  },
});
```

Можно вешать `authenticate` только на `mount` одного маршрута, без уровня Router. Цепочка `.authorize('admin')` не меняет тип `data`; при провале фреймворк отдаёт 403 — в action роль обычно не проверяют снова (тонкие бизнес-права отдельно).

Проверки вручную:

1. Нет `x-user-id` → **401**  
2. Заголовок есть, роли не хватает → **403**  
3. Успех → в action есть `userId`  

## Шаг 5: Допишите OpenAPI security

У кастомной стратегии по умолчанию только 401 из базового `openapi()`. Без security scheme «Authorize» в Swagger не совпадёт с вашим заголовком, а клиенты под Bearer будут ловить **401**.

Переопределите `openapi()` в стратегии (поля по подсказкам типов; сверяйтесь с плагином Bearer):

```typescript
import type { OpenApiInjector } from '@aomex/web';

protected override openapi(): OpenApiInjector {
  return {
    ...super.openapi(),
    onDocument(document) {
      document.components ||= {};
      document.components.securitySchemes ||= {};
      document.components.securitySchemes['gatewayUser'] ||= {
        type: 'apiKey',
        in: 'header',
        name: 'x-user-id',
      };
    },
    onMethod(methodItem) {
      methodItem.security ||= [];
      methodItem.security.push({ gatewayUser: [] });
    },
  };
}
```

Перегенерируйте OpenAPI и проверьте security и описание 401 у операций.

::: warning
Имена заголовков / cookie и security-метаданные должны совпадать с тем, как вы читаете credentials, иначе интеграция будет крутиться на **401**.
:::

## Когда не писать своё

| Ситуация | Подход |
| --- | --- |
| Обычный Bearer / JWT / API Key / Session | Плагинные стратегии |
| Заголовки шлюза, mTLS, своя подпись | Кастомный `Strategy` (эта страница) |
| Health, статика | Отдельный router или `.skip`; см. [Middleware](/ru/core/middleware) |

## JWT: асимметрия и ротация ключей (всё ещё плагин)

Кастом решает **как собрать credentials**; алгоритмы JWT и ротация — в [JWT-стратегии](/ru/plugins/auth-jwt-strategy), переписывать не нужно:

```typescript
import { AuthJwtStrategy } from '@aomex/auth-jwt-strategy';
import fs from 'node:fs';

new AuthJwtStrategy({
  publicKey: fs.readFileSync('public.pem'),
  privateKey: fs.readFileSync('private.pem'),
  verifyOptions: { algorithms: ['RS256'] }, // [!code highlight]
  legacySecretOrPublicKey: [oldSecret],
  onVerified: (payload) => {
    return payload;
  },
});
```

## См. также

- Точка входа и готовые стратегии: [Auth](/ru/plugins/auth)
- Cookie session: [Session-стратегия](/ru/plugins/auth-session-strategy)
- JSON 401 / 403: [Формат ошибок](/ru/web/errors)
