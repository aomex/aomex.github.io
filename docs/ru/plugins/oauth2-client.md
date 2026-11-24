---
outline: deep
---

# OAuth2-клиент

Когда нужен вход «перейти на страницу авторизации → вернуться с code → обменять на token», ядро — `@aomex/oauth2-client`: **authorization code OAuth 2.0** (по умолчанию **PKCE S256**); с `oidc` по OpenID Connect проверяется `id_token` (nonce + JWKS). Состояние входа по-прежнему пишете сами (Bearer / Session / JWT и т.д.).

Частым вендорам не пишите эндпоинты руками: сначала пресет `@aomex-contrib/oauth2-*` из [aomex-contrib](https://github.com/aomex/aomex-contrib); свой IdP или отсутствующий в списке — тогда `new OAuth2Client`.

```bash
pnpm add @aomex/oauth2-client
# peer：@aomex/web @aomex/cache @aomex/common
# при пресете, например: pnpm add @aomex-contrib/oauth2-google
```

## Пресеты вендоров (рекомендуется)

Пресет-пакет заполняет authorize / token (или OIDC `issuer`) и scope по умолчанию, типы возврата сужены под вендора. Детали бэкенда и полей — в **README каждого пакета** (ссылки в таблице ниже).

В организации удобно: **один вендор — один Service** — внутри Service `protected` держит клиента, наружу только `oauthRedirect` / `oauthCallback`; маршруты зовут `services.xxx`, не разбрасывайте `new GoogleOAuth2Client` по action. Как в скаффолде и [сервисном слое](/ru/core/service).

Пример Google (полный redirect OIDC):

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

В маршрутах только Service:

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
    // без onProfile: уже проверенные claims id_token (sub / email …)
    // здесь пишите сессию: выдача Bearer / запись Session …
    ctx.send(claims);
  },
});
```

GitHub аналогично: отдельный `GithubService` с `GitHubOAuth2Client`; у `callback` по умолчанию чаще `{ base, userinfo }`. `redirectUri` через `(ctx) => …` собирает колбэк по origin запроса — удобно при нескольких доменах.

`store` временно держит `state` (и PKCE verifier). При конструкторе через `registerLifecycle` автоматически `connect` / при shutdown `disconnect`. Локально — memory; в проде на нескольких инстансах — Redis-адаптер (скаффолд часто сразу `CacheRedisAdapter`), иначе колбэк может попасть на другую машину без state. TTL state по умолчанию `'10 minutes'` (`stateTtl`, `DurationInput`); при параллельных callback успешен только один, при сбое обмена билета state **не** восстанавливается.

Для GIS / One Tap с `credential` не берите oauth2-google — пакет `google-identity-login` из таблицы ниже (тоже можно свернуть в Service).

### Обзор пресетов

Пакеты в [aomex/aomex-contrib](https://github.com/aomex/aomex-contrib); установка вроде `pnpm add @aomex-contrib/oauth2-google @aomex/oauth2-client`. Имя пакета ведёт в README репозитория.

| Пакет | Описание |
| --- | --- |
| [`oauth2-google`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-google) | Google OIDC (полный redirect) |
| [`oauth2-microsoft`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-microsoft) | Microsoft / Entra ID OIDC |
| [`oauth2-apple`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-apple) | Sign in with Apple (`form_post` + JWT `client_secret`) |
| [`oauth2-github`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-github) | GitHub OAuth App |
| [`oauth2-discord`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-discord) | Discord |
| [`oauth2-gitlab`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-gitlab) | GitLab.com |
| [`oauth2-linkedin`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-linkedin) | LinkedIn |
| [`oauth2-facebook`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-facebook) | Facebook Login |
| [`oauth2-twitter`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-twitter) | Twitter（X） |
| [`oauth2-spotify`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-spotify) | Spotify (обмен часто с `tokenAuth: 'basic'`) |
| [`oauth2-wechat`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-wechat) | WeChat Open Platform: QR / веб-авторизация официального аккаунта и т.п. |
| [`oauth2-wecom`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-wecom) | WeCom: веб-авторизация собственного приложения |

То, что **не** полный redirect OAuth, вынесено в отдельные пакеты `*-login` — не встраивайте в поток таблицы выше:

| Пакет | Описание |
| --- | --- |
| [`google-identity-login`](https://github.com/aomex/aomex-contrib/tree/main/packages/google-identity-login) | Google GIS: проверка `credential` / обмен code / userinfo |
| [`wechat-mini-program-login`](https://github.com/aomex/aomex-contrib/tree/main/packages/wechat-mini-program-login) | WeChat mini program `code2Session` + телефон (не OAuth) |

Свой тонкий вендорный wrapper можно собрать на [`oauth2-preset`](https://github.com/aomex/aomex-contrib/tree/main/packages/oauth2-preset) через `mergeOAuth2Preset` / `mergeOidcPreset`; бизнес-приложению обычно **не** нужно зависеть от него напрямую.

## Ручной OAuth2Client

Нет в списке или свой IdP — тоже в Service: внутри `new OAuth2Client(...)`, маршруты по-прежнему только `services.idp.oauthRedirect` и т.п.

### Чистый OAuth2: эндпоинты вручную

Без OIDC discovery обязательны `authorizationEndpoint` / `tokenEndpoint` и `onProfile`.

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

С `oidc.issuer` запрашивается `/.well-known/openid-configuration` — эндпоинты и jwks. Если в scope нет `openid`, он добавится сам. Без `onProfile` `callback` сразу возвращает **уже проверенные** claims.

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

Чтобы по claims писать в БД — `onProfile` с доп. `oidc.claims`:

```typescript
onProfile: async ({ token, oidc, ctx }) => {
  return upsertUserFromClaims(oidc.claims, token);
},
```

Если в `id_token` есть `at_hash`, он сверяется с текущим `access_token`; при множественном `aud` ещё требуется `azp` = `client_id`. Discovery можно перекрыть `oidc.jwksUri` / `expectedIssuer`.

## Обновление и отзыв

После входа бизнес сам хранит `refresh_token`; до истечения в Service вызывайте `refresh` на `this.oauth`. Опциональный `scope` только сужает, не расширяет. При выходе или отбраковке билета — `revoke` (нужен `revocationEndpoint`; без ручной записи OIDC попробует discovery `revocation_endpoint`; чистому OAuth2 URL часто пишут вручную).

```typescript
const tokens = await this.oauth.refresh(storedRefreshToken);
await this.oauth.revoke(tokens.access_token, {
  tokenTypeHint: 'access_token',
});
```

В конструкторе часто трогают: `redirectUri` — фиксированная строка или `(ctx) => string` по origin (несколько доменов); `clientSecret` — также `() => string | Promise<string>` (динамический JWT у Apple); `pkce` по умолчанию `true` (S256), выключают только редкие старые эндпоинты; учётные данные обмена по умолчанию в body, Spotify и др. — `tokenAuth: 'basic'`; `stateTtl` по умолчанию `'10 minutes'`; доп. query авторизации — `authorizationParams` (не перекрывает обязательные поля).

::: warning
`callback` принимает только authorization code (`code` + `state`). Если в колбэке есть query implicit / hybrid `id_token` или `token`, state очистится и будет ошибка. При отмене пользователем authorization server часто шлёт `error` (например `access_denied`) — после проверки и потребления state бросается ошибка; текст подсказки решаете в маршруте. У Apple и др. может быть **POST form_post** — смотрите README соответствующего пресета.
:::

## Как стыковать с Auth

Пакет и пресеты **не** являются стратегиями `@aomex/auth`: после Profile / claims / `{ base, userinfo }` вы сами выдаёте свои учётные данные. Типично: в `oauthCallback` или маршруте `upsert` → `auth.strategy('bearer').signature(...)` или запись [Session](/ru/plugins/auth-session-strategy) → дальше интерфейсы через `authenticate`.

## Связанное

- Репозиторий и список пакетов: [aomex-contrib](https://github.com/aomex/aomex-contrib)
- Регистрация сервисов: [Сервисный слой](/ru/core/service)
- state / single-flight / длительности: [Кеш](/ru/core/cache)
- Аутентификация после входа: [Единый вход Auth](/ru/plugins/auth)
- Cookie-сессия: [Стратегия Session](/ru/plugins/auth-session-strategy)
- Выдача JWT: [Стратегия JWT](/ru/plugins/auth-jwt-strategy)
