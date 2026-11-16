---
outline: deep
---

# API Key 전략

스크립트·파트너·내부 서비스용 「키를 들고 API 호출」 채널. 헤더·쿼리·커스텀 위치는 `keyLoader`로 맞춥니다. 실패는 **401**; 권한은 `onAuthorize` 또는 라우트 `authorize`.

Bearer 사용자 세션과 병행 가능—Router마다 다른 전략 이름. 성공 후 `ctx.auth.apiKey`에 파트너/테넌트 메타를 읽습니다.

```bash
pnpm add @aomex/auth
```

```typescript
import { AuthApiKeyStrategy } from '@aomex/auth/api-key';
```

## 오픈 플랫폼 Router

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

Bearer와 공존—Router별 다른 전략 이름.

성공 후:

```typescript
ctx.auth.apiKey // { key: string; data: T }
```

추가 `authorize('apiKey', …)` 인자는 Bearer처럼 `onAuthorize`를 따릅니다. `onAuthorize` 없으면 보통 「유효한 키」만 검사.

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

`signature()`는 클라이언트 발급 시 랜덤 키 생성—Bearer와 비슷.

[@aomex/rate-limit](/ko/plugins/rate-limit)와 함께 키별 한도를 걸기 좋습니다.

```typescript
rateLimit({
  id: (ctx) => { // [!code highlight]
    return ctx.auth.apiKey?.key ?? ctx.request.ip;
  },
});
```

OpenAPI에 `apiKey` scheme 주입; `in` / `name`은 보통 **첫** `keyLoader`에서.

::: warning
키 유출 = 해당 키 권한 전부. 로테이션·해지 경로를 미리 둡니다.
:::

## 관련

- [인증 개요](/ko/plugins/auth)
- [속도 제한](/ko/plugins/rate-limit)