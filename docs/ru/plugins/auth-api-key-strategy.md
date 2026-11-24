---
outline: deep
---

# Стратегия API Key

Канал «с ключом можно вызывать» для скриптов, партнёров или внутренних сервисов. AuthApiKeyStrategy читает **голый** ключ из заголовка (или настроенных query/cookie) и отображает в личность приложения — это **не** двухчастная форма Bearer. Для входа конечного пользователя — [Bearer](/ru/plugins/auth-bearer-strategy) или [JWT](/ru/plugins/auth-jwt-strategy).

Проверка `x-api-key` (или своего заголовка); после успеха в бизнесе — `ctx.auth.apiKey`; открытую платформу можно вынести на другой prefix Router, отдельно от пользовательского входа.

## Установка

Тот же основной пакет `@aomex/auth`, что и Bearer.

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

Рядом с пользовательским Bearer имена стратегий независимы — вешайте на разные Router.

После успеха:

```typescript
ctx.auth.apiKey // { key: string; data: T }
```

Тип доп. аргументов `authorize('apiKey', …)` как у Bearer — из вашего `onAuthorize`. Без `onAuthorize` обычно только слой «есть ли валидный key».

## Key из нескольких источников и измерение лимита

`onLoaded` обязателен: проверить key и вернуть личность приложения. По умолчанию только заголовок `x-api-key`; для порядка header / query / cookie — `keyLoaders`. Доп. слой по scope / тарифу — `onAuthorize`.

Поддерживаемые loader: header (голое значение заголовка, имя в нижнем регистре), query (осторожно — легко в логи), cookie. **Чтение Key из body не поддерживается**, чтобы ключ не попадал в логи тела. В проде предпочтителен header.

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


`signature()` генерирует случайную строку Key (при выдаче нового клиента), похоже на стратегию Bearer.

Вместе с [@aomex/rate-limit](/ru/plugins/rate-limit) можно мерить квоту по key — обычно аутентификация уже должна пройти до лимита, или key читаете сами из header:

```typescript
rateLimit({
  id: (ctx) => { // [!code highlight]
    return ctx.auth.apiKey?.key ?? ctx.request.ip;
  },
});
```

OpenAPI получит apiKey scheme; `in` / `name` обычно из **первого** keyLoader.

::: warning
Утечка ключа = утечка прав: храните хеш, поддерживайте ротацию, не держите plaintext долго в БД. API Key — не замена C-end логина; продукты для людей — Bearer/JWT.
:::

Не смешивайте пользовательскую session и API Key в одной группе маршрутов: у открытой платформы отдельный prefix + `authenticate('apiKey')` понятнее.

## Связанное

- [Аутентификация](/ru/plugins/auth)
- [Стратегия Bearer](/ru/plugins/auth-bearer-strategy)
- [Лимит запросов](/ru/plugins/rate-limit)
