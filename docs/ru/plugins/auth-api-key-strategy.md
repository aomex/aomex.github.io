---
outline: deep
---

# Стратегия API Key

Канал «принёс ключ — вызвал API» для скриптов, партнёров, внутренних сервисов. `AuthApiKeyStrategy` читает **сырой** ключ из заголовков (или query/cookie по конфигу) и сопоставляет с идентичностью приложения — не двухчастный Bearer. Логин конечного пользователя: [Bearer](/ru/plugins/auth-bearer-strategy) или [JWT](/ru/plugins/auth-jwt-strategy).

Проверяйте `x-api-key` (или свой header); после успеха `ctx.auth.apiKey`; открытые платформы часто отдельный префикс Router от user login.

## Установка

Общий `@aomex/auth` с Bearer.

```bash
pnpm add @aomex/auth
```

```typescript
import { AuthApiKeyStrategy } from '@aomex/auth/api-key';
```

## Router открытой платформы

```typescript
import { Auth } from '@aomex/auth';
import { AuthApiKeyStrategy } from '@aomex/auth/api-key';
import { Router } from '@aomex/web';

const auth = new Auth({
  strategies: {
    apiKey: new AuthApiKeyStrategy({
      onLoaded: async (key) => {
        const app = await clients.verify(key);
        if (!app) {
          return false;
        }
        return { appId: app.id, scopes: app.scopes };
      },
    }),
  },
});

const openApi = new Router({
  prefix: '/open',
  mount: [auth.authenticate('apiKey')], // [!code highlight]
});

openApi.get('/usage', {
  action: async (ctx) => {
    ctx.send({ appId: ctx.auth.apiKey.data.appId });
  },
});
```

Рядом с user Bearer — разные имена стратегий на разных Router.

После успеха:

```typescript
ctx.auth.apiKey // { key: string; data: T }
```

Доп. аргументы `authorize('apiKey', …)` как у Bearer в `onAuthorize`. Без `onAuthorize` обычно только «ключ валиден».

## keyLoaders и лимиты

| Опция | Когда использовать | По умолчанию |
| --- | --- | --- |
| `keyLoaders` | Порядок header / query / cookie | `[{ type: 'header', key: 'x-api-key' }]` |
| `onLoaded` | Проверка ключа, идентичность | **обязательно** |
| `onAuthorize` | Scopes, тариф и т.д. | опционально |

Loaders:

- `header` — сырое значение (имя ключа в нижнем регистре)
- `query` — осторожно, попадает в логи
- `cookie` — по договорённости команды

**Нет loader из body** — ключи не в логах тела. В проде предпочтительнее header.

```typescript
new AuthApiKeyStrategy({
  keyLoaders: [ // [!code highlight]
    { type: 'header', key: 'x-api-key' },
    { type: 'query', key: 'api_key' },
  ],
  onLoaded: async (key) => {
    return lookup(key);
  },
});
```

`signature()` может генерировать случайные ключи при выдаче клиентам — по аналогии с Bearer.

С [@aomex/rate-limit](/ru/plugins/rate-limit) квота по ключу — обычно сначала authenticate или читаете header сами:

```typescript
rateLimit({
  id: (ctx) => { // [!code highlight]
    return ctx.auth.apiKey?.key ?? ctx.request.ip;
  },
});
```

OpenAPI добавляет схему `apiKey`; `in` / `name` обычно из **первого** `keyLoader`.

::: warning
Утечка ключа = утечка прав: храните хеши, ротация, без долгого plaintext в БД. API Key не замена login пользователя — конечным пользователям Bearer/JWT.
:::

Не смешивайте сессии пользователя и API keys в одной группе маршрутов — отдельный префикс + `authenticate('apiKey')` яснее.

## Связанное

- [Аутентификация](/ru/plugins/auth)
- [Bearer](/ru/plugins/auth-bearer-strategy)
- [Rate limit](/ru/plugins/rate-limit)
