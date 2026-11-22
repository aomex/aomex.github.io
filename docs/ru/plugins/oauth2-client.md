---
outline: deep
---

# OAuth2-клиент

Для «редирект на провайдера → code → обмен на token» ядро — `@aomex/oauth2-client`: **authorization code OAuth 2.0** (по умолчанию **PKCE S256**); с `oidc` проверяется `id_token` как OpenID Connect (nonce + JWKS). Сессию логина вы пишете сами (Bearer / Session / JWT…).

Для обычных вендоров эндпоинты не пишут вручную: ставьте `@aomex-contrib/oauth2-*` из [aomex-contrib](https://github.com/aomex/aomex-contrib). Свой IdP или вендор вне списка — собирайте `OAuth2Client` напрямую.

```bash
pnpm add @aomex/oauth2-client
# peer: @aomex/web @aomex/cache @aomex/common
# если есть пресет, напр.: pnpm add @aomex-contrib/oauth2-google
```

## Пресеты вендоров (предпочтительно)

Пресет заполняет authorize / token (или OIDC `issuer`) и scope по умолчанию, сужает типы ответа. Настройка консоли и поля — в **README каждого пакета** (ссылки ниже).

Организация: **один Service на вендора** — клиент в `protected` на Service, снаружи только `oauthRedirect` / `oauthCallback`; маршруты вызывают `services.xxx` и не разбрасывают `new GoogleOAuth2Client` по action. Та же форма, что у скаффолда и [сервисного слоя](/ru/core/service).

Пример Google (OIDC, полностраничный redirect):

```typescript
// src/services/google.service.ts
import { Service } from '@aomex/common';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import type { WebContext } from '@aomex/web';
import { GoogleOAuth2Client } from '@aomex-contrib/oauth2-google';

export default class GoogleService extends Service {
  protected readonly oauth = new GoogleOAuth2Client({ // [!code focus:8]
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: (ctx) => {
      return `${ctx.request.origin}/oauth/google/callback`;
    },
    store: new CacheMemoryAdapter(),
  });

  oauthRedirect(ctx: WebContext) {
    return this.oauth.redirect(ctx);
  }

  oauthCallback(ctx: WebContext) {
    return this.oauth.callback(ctx);
  }
}
```

Регистрация в `combineServices` (фабрика `() => import(...)`):

```typescript
export const services = await combineServices({
  google: () => import('./google.service.js'),
  // github: () => import('./github.service.js'),
});
```

В маршрутах только вызовы Service:

```typescript
import { Router } from '@aomex/web';
import { services } from '../services/index.js';

export const router = new Router({ prefix: '/oauth' });

router.get('/google', {
  action: async (ctx) => {
    await services.google.oauthRedirect(ctx); // [!code highlight]
  },
});

router.get('/google/callback', {
  action: async (ctx) => {
    const claims = await services.google.oauthCallback(ctx); // [!code highlight]
    // без onProfile: проверенные id_token claims (sub / email …)
    // здесь выдача своей сессии: Bearer / Session …
    ctx.send(claims);
  },
});
```

GitHub — та же схема: отдельный `GithubService` с `GitHubOAuth2Client`; `callback` часто даёт `{ base, userinfo }`. Функция `redirectUri` собирает callback из `ctx.request.origin` для нескольких хостов.

`store` держит `state` (и PKCE verifier). Конструктор через `registerLifecycle` сам делает `connect` / при остановке `disconnect`. Локально хватает memory; в проде на нескольких инстансах — Redis-адаптер (скаффолд часто сразу `CacheRedisAdapter`), иначе callback попадёт на другую машину без state. TTL state по умолчанию `'10 minutes'` (`stateTtl`, `DurationInput`). Параллельные callback успешны только у одной стороны; при сбое обмена state **не восстанавливается**.

Для GIS / One Tap с `credential` на фронте **не** используйте oauth2-google — берите `google-identity-login` ниже (тоже можно оформить отдельным Service).

### Каталог пресетов

Пакеты в [aomex/aomex-contrib](https://github.com/aomex/aomex-contrib); установка вида `pnpm add @aomex-contrib/oauth2-google @aomex/oauth2-client`. Откройте имя пакета ради README.

| Пакет | Описание |
| --- | --- |
| [`oauth2-google`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-google) | Google OIDC (полностраничный redirect) |
| [`oauth2-microsoft`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-microsoft) | Microsoft / Entra ID OIDC |
| [`oauth2-apple`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-apple) | Sign in with Apple (`form_post` + JWT `client_secret`) |
| [`oauth2-github`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-github) | GitHub OAuth App |
| [`oauth2-discord`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-discord) | Discord |
| [`oauth2-gitlab`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-gitlab) | GitLab.com |
| [`oauth2-linkedin`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-linkedin) | LinkedIn |
| [`oauth2-facebook`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-facebook) | Facebook Login |
| [`oauth2-twitter`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-twitter) | Twitter (X) |
| [`oauth2-spotify`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-spotify) | Spotify (обмен токена часто с `tokenAuth: 'basic'`) |
| [`oauth2-wechat`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-wechat) | Открытая платформа WeChat (скан на сайте) / веб-авторизация официального аккаунта |
| [`oauth2-wecom`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-wecom) | WeCom (корпоративный WeChat): веб-авторизация своего приложения |

**Не** полностраничный redirect OAuth — отдельные пакеты `*-login`:

| Пакет | Описание |
| --- | --- |
| [`google-identity-login`](https://github.com/aomex/aomex-contrib/tree/main/packages/google-identity-login) | Google GIS: проверка `credential` / обмен code / userinfo |
| [`wechat-mini-program-login`](https://github.com/aomex/aomex-contrib/tree/main/packages/wechat-mini-program-login) | Мини-программа WeChat: `code2Session` + телефон (не OAuth) |

Для своего тонкого враппера вендора можно взять [`oauth2-preset`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-preset) (`mergeOAuth2Preset` / `mergeOidcPreset`). Приложениям обычно **не** нужно зависеть от него напрямую.

## Ручной `OAuth2Client`

Если вендора нет в списке или это свой IdP — тоже кладите в Service: внутри `new OAuth2Client(...)`, маршруты только вызывают методы вроде `services.idp.oauthRedirect`.

### Чистый OAuth2: эндпоинты вручную

Без OIDC discovery нужны `authorizationEndpoint` / `tokenEndpoint` и `onProfile`.

```typescript
import { Service } from '@aomex/common';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import type { WebContext } from '@aomex/web';
import { OAuth2Client } from '@aomex/oauth2-client';

export default class IdpService extends Service {
  protected readonly oauth = new OAuth2Client({ // [!code focus:14]
    authorizationEndpoint: 'https://idp.example.com/oauth/authorize',
    tokenEndpoint: 'https://idp.example.com/oauth/token',
    clientId: process.env.IDP_CLIENT_ID!,
    clientSecret: process.env.IDP_CLIENT_SECRET!,
    redirectUri: (ctx) => {
      return `${ctx.request.origin}/oauth/callback`;
    },
    scopes: ['profile'],
    store: new CacheMemoryAdapter(),
    onProfile: async ({ token }) => {
      const res = await fetch('https://idp.example.com/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      return res.json();
    },
  });

  oauthRedirect(ctx: WebContext) {
    return this.oauth.redirect(ctx);
  }

  oauthCallback(ctx: WebContext) {
    return this.oauth.callback(ctx);
  }
}
```

### OIDC: discovery + проверка id_token

Задайте `oidc.issuer` — подтянется `/.well-known/openid-configuration`. Без `openid` в scope он добавится. Без `onProfile` `callback` возвращает **проверенные** claims.

```typescript
protected readonly oauth = new OAuth2Client({ // [!code focus:8]
  clientId: process.env.OIDC_CLIENT_ID!,
  clientSecret: process.env.OIDC_CLIENT_SECRET!,
  redirectUri: (ctx) => {
    return `${ctx.request.origin}/oauth/callback`;
  },
  scopes: ['openid', 'email', 'profile'],
  store: new CacheMemoryAdapter(),
  oidc: { issuer: 'https://accounts.example.com' },
});
```

Маппинг claims в бизнес-пользователя через `onProfile` (в аргументах `oidc.claims`):

```typescript
onProfile: async ({ token, oidc, ctx }) => {
  return upsertUserFromClaims(oidc.claims, token);
},
```

Если в `id_token` есть `at_hash`, он сверяется с этим `access_token`; при множественном `aud` нужен `azp` = `client_id`. Discovery можно перекрыть через `oidc.jwksUri` / `expectedIssuer`.

## Обновление и отзыв

После логина сохраните `refresh_token` сами; до истечения вызывайте `this.oauth.refresh` внутри Service. Опциональный `scope` только сужает. При выходе или инвалидации — `revoke` (нужен `revocationEndpoint`; для OIDC без явной настройки берётся discovery `revocation_endpoint`).

```typescript
const tokens = await this.oauth.refresh(storedRefreshToken);
await this.oauth.revoke(tokens.access_token, {
  tokenTypeHint: 'access_token',
});
```

## Часто меняемые опции

| Опция | Назначение |
| --- | --- |
| `redirectUri` | Строка или `(ctx) => string` (несколько хостов) |
| `clientSecret` | Строка или `() => string \| Promise<string>` (динамический JWT Apple) |
| `pkce` | По умолчанию `true` (S256); выключайте только для редких legacy |
| `tokenAuth` | Куда класть учётные данные при обмене: `body` (по умолчанию) или `basic` |
| `stateTtl` | Сколько живёт state; по умолчанию `'10 minutes'` |
| `authorizationParams` | Доп. query в URL авторизации (обязательные поля не перезаписывает) |
| `revocationEndpoint` | URL отзыва; для чистого OAuth2 часто нужен вручную |

::: warning
`callback` принимает только authorization-code (`code` + `state`). Implicit / hybrid с `id_token` или `token` в query очищают state и бросают ошибку. При отмене пользователем часто приходит `error` (например `access_denied`); state проверяется и потребляется, затем throw. У части вендоров (Apple) — **POST form_post**; смотрите README пресета.
:::

## Связка с Auth

Ни ядро, ни пресеты не являются стратегией `@aomex/auth`: они дают Profile / claims / `{ base, userinfo }`; дальше вы выдаёте свои credentials. Типично: upsert в `oauthCallback` или маршруте → `auth.strategy('bearer').signature(...)` или [Session](/ru/plugins/auth-session-strategy) → дальше `authenticate`.

## Связанное

- Репозиторий и список пакетов: [aomex-contrib](https://github.com/aomex/aomex-contrib)
- Регистрация сервисов: [Сервисный слой](/ru/core/service)
- state / однократный расчёт при конкуренции / длительности: [Кэш](/ru/core/cache)
- Auth после логина: [Auth](/ru/plugins/auth)
- Cookie-сессии: [Стратегия Session](/ru/plugins/auth-session-strategy)
- Выдача JWT: [Стратегия JWT](/ru/plugins/auth-jwt-strategy)
