---
outline: deep
---

# Аутентификация

Две идеи: **кто вы** (аутентификация) и **что можно делать** (авторизация). `@aomex/auth` собирает стратегии в одном `Auth`: провал идентичности обычно **401**, недостаточно прав — **403**. Фронт и мониторинг различают «залогиниться» и «другой аккаунт / нужна роль».

Для группы маршрутов «сначала логин», на части — выше роль; login без auth; после входа идентичность в `ctx.auth`.

## Установка

Ставьте пакеты под стратегии; до появления login эта страница — дорожная карта.

```bash
pnpm add @aomex/auth
# JWT 另装：pnpm add @aomex/auth-jwt-strategy
```

| Пакет стратегии | Типичный сценарий |
| --- | --- |
| [`@aomex/auth/bearer`](/ru/plugins/auth-bearer-strategy) | Непрозрачный token, сессия на сервере |
| [`@aomex/auth/api-key`](/ru/plugins/auth-api-key-strategy) | Machine-to-machine, открытая платформа |
| [`@aomex/auth-jwt-strategy`](/ru/plugins/auth-jwt-strategy) | Самодостаточный JWT, меньше обращений к БД |

## authenticate на Router

Стратегии в `Auth` (Bearer / API Key / JWT); `authenticate(name)` — middleware идентичности на Router или маршрут. После успеха `ctx.auth[name]`; на маршруте `authorize` для детальных прав.

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

Цепочка на одном маршруте:

```typescript
router.post('/admin/reboot', {
  mount: [auth.authenticate('bearer').authorize(99)], // [!code highlight]
  action: async (ctx) => {
    // …
  },
});
```

- `ctx.auth.bearer` имеет смысл после `authenticate('bearer')`; в типах есть имя стратегии.
- Второй аргумент `authorize('bearer', 10)` следует сигнатуре `onAuthorize` (число, код права и т.д.).
- `auth.strategy('bearer').signature(...)` — на **login action** для выдачи token, не в auth-middleware.

```typescript
// 登录成功后签发（示例）
const token = auth.strategy('bearer').signature('sha256', user.id);
```

## authenticate(name)

| Когда | Куда |
| --- | --- |
| Вся группа — только после логина | `Router.mount` |
| Публичные и приватные в одном файле | `mount` на маршруте или два Router |

Провал стратегии → **401**; успех пишет `ctx.auth[name]`. У middleware есть `.authorize(...)` для цепочки. **401** — нет/битый token; **403** — вошли, но нельзя; не смешивайте смысл.

### authorize(name, ...args)

Предполагает **уже** пройденную аутентификацию этой стратегии. Только `authorize` без `authenticate` в рантайме не спасёт — смотрите порядок mount. Обычно **403**.

### strategy(name)

Выдача credentials при login/refresh (случайный Bearer, JWT payload и т.д.). **Не вешайте authenticate на login** — без token клиент не зайдёт.

### Куда монтировать

| Место | Подходит | Заметка |
| --- | --- | --- |
| `Router.mount` | Вся приватная API-группа | Не смешивайте публичные маршруты в том же файле |
| `mount` на маршруте | Отдельные публичные / жёстче auth | Повторы — в константу |
| `WebApp.mount` | Почти весь сайт приватный | Health check — отдельный Router |

Публичные API — отдельный Router без `authenticate`, а не `skip` повсюду.

В `generateOpenapi` передайте тот же `app`, что в проде — `security` в доке совпадёт с реальностью. При нескольких стратегиях имена `authenticate('jwt')` = ключи в `strategies`.

## Связанное

- [Bearer](/ru/plugins/auth-bearer-strategy)
- [API Key](/ru/plugins/auth-api-key-strategy)
- [JWT](/ru/plugins/auth-jwt-strategy)
- Нестандартный протокол: [Своя стратегия auth](/ru/advanced/auth-strategy)
