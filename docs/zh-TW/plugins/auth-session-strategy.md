---
outline: deep
---

# Session 策略

瀏覽器端登入態放在 **HttpOnly Cookie** 裡：Cookie 只存不透明 `sessionId`，使用者資料在共享的 [`Caching`](/zh-TW/core/cache)（memory / Redis）裡。SPA 跨域時還要同時配好 [CORS](/zh-TW/plugins/cors)（帶 Cookie）和 [CSRF](/zh-TW/plugins/csrf)（防跨站寫請求）——少一塊，登入態要麼帶不過去，要麼容易被第三方站點濫用。

適合「同站或可信前端 + 服務端隨時可廢會話」；純移動端 / 機器呼叫更常見 [Bearer](/zh-TW/plugins/auth-bearer-strategy) 或 [JWT](/zh-TW/plugins/auth-jwt-strategy)。

## 安裝

Session 策略隨 `@aomex/auth` 主包提供；存會話還要 `@aomex/cache`（及生產用的 Redis 適配器）。跨域 Cookie 場景再裝 CORS / CSRF。

```bash
pnpm add @aomex/auth @aomex/cache
# 跨域 Cookie：pnpm add @aomex/cors @aomex/csrf
# 多实例共享会话：pnpm add @aomex/cache-redis-adapter
```

```typescript
import { AuthSessionStrategy } from '@aomex/auth/session';
```

## 先把 CORS 和 CSRF 掛上

跨域前端要帶 Cookie，瀏覽器要求：

1. 請求帶 `credentials: 'include'`（或 XHR `withCredentials`）
2. 響應有 `Access-Control-Allow-Credentials: true`，且 `Access-Control-Allow-Origin` 是**具體域名**（不能是 `*`）
3. 寫操作帶上 CSRF 頭，否則別人的頁面也能「借」你的 Cookie 發 POST

`credentials: true` 時 **必須顯式配 `origin`**，不能再靠無參 cors() 的預設反射——啟動期就會拋錯。CSRF 用雙提交 Cookie：可讀 Cookie `csrfToken` 與請求頭 `x-csrf-token` 一致才放行。

```typescript
import { cors } from '@aomex/cors';
import { csrf } from '@aomex/csrf';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:8]
    cors({
      origin: 'https://app.example.com',
      credentials: true,
      allowHeaders: ['Content-Type', 'x-csrf-token'],
    }),
    csrf(),
    routers('./src/routers'),
  ],
});
```

::: tip
本地分埠除錯時，把 origin 換成 `http://localhost:5173`（或你的前端地址），不要用 `*`。同站部署（前後端同 origin）可以省略 cors()，但 CSRF 建議仍掛著。
:::

掛載順序：cors → csrf → routers。兩者都要在 routers **之前**，錯誤響應才會帶上 CORS / 剛簽發的 CSRF Cookie。

前端每次改資料的請求大致是：

```typescript
const csrfToken = document.cookie
  .split('; ')
  .find((row) => row.startsWith('csrfToken='))
  ?.split('=')[1];

await fetch('https://api.example.com/api/posts', {
  method: 'POST',
  credentials: 'include', // [!code highlight]
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken!, // [!code highlight]
  },
  body: JSON.stringify({ title: 'hi' }),
});
```

GET 等安全方法預設不校驗 CSRF；首次訪問會先簽發 `csrfToken` Cookie（`HttpOnly=false`，JS 可讀）。細則見 [CSRF](/zh-TW/plugins/csrf)。

## store、cookie 與 onLoaded

`cookie.maxAge`（秒）必填，同時作為快取 TTL。`onLoaded` 把存進 cache 的 Stored 收成業務身份；使用者已登出可返回 `false` → **401**。

```typescript
import { Auth } from '@aomex/auth';
import { AuthSessionStrategy } from '@aomex/auth/session';
import { Caching } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import { body, Router } from '@aomex/web';
import { rule } from '@aomex/common';

const cache = new Caching(new CacheMemoryAdapter());

const auth = new Auth({
  strategies: {
    session: new AuthSessionStrategy({
      store: cache, // [!code highlight]
      cookie: {
        maxAge: 7 * 24 * 3600,
        // 生产跨站前端常见：sameSite: 'none', secure: true
      },
      onLoaded: async (data: { userId: number }) => {
        const user = await findActiveUser(data.userId);
        return user ?? false;
      },
      onAuthorize(minRole: number) {
        return this.getIdentity().role >= minRole;
      },
    }),
  },
});
```

生產或多實例請換成掛了 Redis 等外接適配器的同一份 `Caching`，見 [快取](/zh-TW/core/cache)。Cookie 預設名 `sessionId`；`setCookie` 預設 `httpOnly: true`、`sameSite: Strict`（跨站前端要改成 `'none'` 並開 `secure`）。`cookie.name` / `path` / `domain` 與前端域名對齊即可。

活躍使用者少被迫下線時，開 `sliding`：每次認證成功續期 TTL + Cookie。自定義快取鍵字首用 `generateCacheKey`（預設 `auth:session:${sessionId}`）。需要 `authorize(角色)` 時再寫 `onAuthorize`。

## 登入、鑑權、退出

登入路由**不要**掛 `authenticate`。用 `strategy.login(ctx, stored)` 寫快取並設 Cookie（簽發新的 `sessionId`；若請求已帶舊 Cookie，寫入成功後刪掉舊會話）。私有介面掛 `authenticate('session')`，讀 `ctx.auth.session`。

```typescript
const session = auth.strategy('session');

export const publicRouter = new Router({ prefix: '/api' });

publicRouter.post('/login', { // [!code focus:12]
  mount: [body({ email: rule.email(), password: rule.string() })],
  action: async (ctx) => {
    const user = await verifyPassword(ctx.body);
    if (!user) {
      return ctx.throw(401, 'invalid credentials');
    }

    await session.login(ctx, { userId: user.id }); // [!code highlight]
    ctx.send({ ok: true });
  },
});

publicRouter.post('/logout', {
  action: async (ctx) => {
    await session.logout(ctx);
    ctx.send(204, null);
  },
});

export const privateRouter = new Router({
  prefix: '/api',
  mount: [auth.authenticate('session')],
});

privateRouter.get('/me', {
  action: async (ctx) => {
    ctx.send(ctx.auth.session.data); // [!code highlight]
  },
});
```

認證成功後：

```typescript
ctx.auth.session // { sessionId: string; data: Loaded }
```

`data` 是 `onLoaded` 的返回值。`logout` 刪快取並清 Cookie；`touch` 只續期不改儲存內容。提權或敏感操作後再輪換 id 時，呼叫 `regenerateSessionId(ctx)`（也可順帶傳入新的 Stored）。

::: warning
跨域時前端必須 `credentials: 'include'`，否則瀏覽器不會帶上 `sessionId` Cookie，看起來像「登入成功但立刻 401」。
:::

## 與 Bearer / JWT 怎麼選

| | Session | Bearer / JWT |
| --- | --- | --- |
| 憑證放哪 | HttpOnly Cookie | 頭 / 本地儲存 |
| 跨域 | 要 CORS credentials + 常要 CSRF | 一般只帶 `Authorization` |
| 吊銷 | 刪快取即可 | Bearer 刪會話；JWT 靠短 TTL / 黑名單 |
| 典型客戶端 | 瀏覽器 SPA / 管理臺 | App、開放平臺、服務間 |

同站管理臺優先 Session；開放 API 優先 Bearer 或 JWT。總入口見 [身份認證](/zh-TW/plugins/auth)。

## 相關

- [跨域 CORS](/zh-TW/plugins/cors)
- [CSRF](/zh-TW/plugins/csrf)
- [身份認證](/zh-TW/plugins/auth)
- [快取](/zh-TW/core/cache)
- [Bearer 策略](/zh-TW/plugins/auth-bearer-strategy)
