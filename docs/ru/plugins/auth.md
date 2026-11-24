---
outline: deep
---

# Аутентификация

Сначала разделите два вопроса: **кто это** (аутентификация) и **можно ли делать это** (авторизация). `@aomex/auth` собирает несколько стратегий в один экземпляр Auth: не прошедшая личность обычно **401**, личность есть, но прав не хватает — **403**. Фронт и мониторинг по коду решают «идти логиниться» или «сменить аккаунт / поднять права».

На группу бизнес-API вешается «сначала войти»; у части интерфейсов — ещё выше роль; сам логин без authenticate; после входа личность читается из `ctx.auth`.

## Установка

Ставьте пакеты под реальные стратегии; пока логина нет, эту страницу можно читать как дорожную карту.

```bash
pnpm add @aomex/auth
# JWT отдельно: pnpm add @aomex/auth-jwt-strategy
# Session ещё: pnpm add @aomex/cache (кросс-домен — @aomex/cors @aomex/csrf)
```

| Пакет стратегии | Типичный сценарий |
| --- | --- |
| [`@aomex/auth/bearer`](/ru/plugins/auth-bearer-strategy) | непрозрачный token, сессия на сервере |
| [`@aomex/auth/session`](/ru/plugins/auth-session-strategy) | Cookie в браузере; вместе с CORS + CSRF |
| [`@aomex/auth/api-key`](/ru/plugins/auth-api-key-strategy) | машина–машина, открытая платформа |
| [`@aomex/auth-jwt-strategy`](/ru/plugins/auth-jwt-strategy) | самодостаточный JWT, меньше ходов в БД |
| [`@aomex/oauth2-client`](/ru/plugins/oauth2-client) | сторонний authorization code; частые вендоры — пресеты [aomex-contrib](https://github.com/aomex/aomex-contrib) (не стратегия Auth; после колбэка выдаёте одну из стратегий выше) |

## Группа приватного API: authenticate на Router

В экземпляре `Auth` регистрируют стратегии (Bearer / Session / API Key / JWT); `authenticate(name)` возвращает middleware «сначала личность». Когда вся группа интерфейсов требует входа — вешайте на `Router.mount`; после успеха `ctx.auth[name]` читает личность.

```typescript
import { Auth } from '@aomex/auth';
import { AuthBearerStrategy } from '@aomex/auth/bearer';
import { Router } from '@aomex/web';

const auth = new Auth({
  strategies: {
    bearer: new AuthBearerStrategy({
      onLoaded: async (token) => {
        const user = await findUserByToken(token);
        return user ?? false; // false → 401
      },
      onAuthorize(minRole: number) {
        return this.getIdentity().role >= minRole;
      },
    }),
  },
});

export const router = new Router({ // [!code focus:10]
  prefix: '/api',
  mount: [auth.authenticate('bearer')], // [!code highlight]
});

router.get('/profile', {
  action: async (ctx) => {
    ctx.send(ctx.auth.bearer.data);
  },
});

router.delete('/posts/:id', {
  mount: [auth.authorize('bearer', 10)],
  action: async (ctx) => {
    ctx.send(204, null);
  },
});
```

- `ctx.auth.bearer` имеет смысл только после `authenticate('bearer')` и успеха; в типах появится поле с именем стратегии.
- Тип второго аргумента `authorize('bearer', 10)` берётся из вашей сигнатуры `onAuthorize` (число, код права и т.д.). Неуспех обычно **403** — предполагается, что **уже** прошли authenticate соответствующей стратегии; только authorize без authenticate runtime не «подстрахует» как типы.

Когда на одном маршруте нужно «сначала войти, потом права», можно цепочкой:

```typescript
router.post('/admin/reboot', {
  mount: [auth.authenticate('bearer').authorize(99)], // [!code highlight]
  action: async (ctx) => {
    // …
  },
});
```

## Как выдавать при логине

При логине и обновлении токена в бизнес-коде вызывайте `auth.strategy(name)` для выдачи (случайная строка Bearer, JWT payload и т.д.). **На маршрут логина не вешайте authenticate**, иначе без token никогда не войдёте.

```typescript
// после успешного логина (пример)
const token = auth.strategy('bearer').signature('sha256', user.id);
```

## Публичные интерфейсы не впихивайте в уже аутентифицированный Router

| Место | Подходит |
| --- | --- |
| `Router.mount` | вся группа приватного API |
| mount одного маршрута | отдельные публичные / более жёсткая авторизация; когда в одном файле с публичными |
| `WebApp.mount` | почти весь сайт приватный; health-check — отдельный Router |

Публичные маршруты лучше не втискивать в уже аутентифицированный Router: отдельный Router без authenticate проще, чем skip повсюду. Повторяющиеся `authorize(...)` выносите в константы.

Не вошли / невалидный token — **401**; вошли, но роли мало — **403**, не смешивайте смыслы. При генерации OpenAPI передайте в `generateOpenapi` тот же `app`, что в проде — тогда security в доке совпадёт с реальной аутентификацией. При нескольких стратегиях имена вроде `authenticate('jwt')` должны совпадать с ключами strategies.

## Связанное

- [Стратегия Bearer](/ru/plugins/auth-bearer-strategy)
- [Стратегия Session](/ru/plugins/auth-session-strategy)
- [Стратегия API Key](/ru/plugins/auth-api-key-strategy)
- [Стратегия JWT](/ru/plugins/auth-jwt-strategy)
- Сторонний authorization code: [OAuth2-клиент](/ru/plugins/oauth2-client)
- Особый протокол: [Продвинутое: своя стратегия аутентификации](/ru/advanced/auth-strategy)
