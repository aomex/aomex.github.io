---
outline: deep
---

# Session 策略

浏览器端登录态放在 **HttpOnly Cookie** 里：Cookie 只存不透明 `sessionId`，用户数据在 `@aomex/cache` 适配器（memory / Redis）里。SPA 跨域时还要同时配好 [CORS](/zh/plugins/cors)（带 Cookie）和 [CSRF](/zh/plugins/csrf)（防跨站写请求）——少一块，登录态要么带不过去，要么容易被第三方站点滥用。

适合「同站或可信前端 + 服务端随时可废会话」；纯移动端 / 机器调用更常见 [Bearer](/zh/plugins/auth-bearer-strategy) 或 [JWT](/zh/plugins/auth-jwt-strategy)。

## 安装

Session 策略随 `@aomex/auth` 主包提供；存会话还要 `@aomex/cache`（及生产用的 Redis 适配器）。跨域 Cookie 场景再装 CORS / CSRF。

```bash
pnpm add @aomex/auth @aomex/cache
# 跨域 Cookie：pnpm add @aomex/cors @aomex/csrf
# 多实例共享会话：pnpm add @aomex/cache-redis-adapter
```

```typescript
import { AuthSessionStrategy } from '@aomex/auth/session';
```

## 先把 CORS 和 CSRF 挂上

跨域前端要带 Cookie，浏览器要求：

1. 请求带 `credentials: 'include'`（或 XHR `withCredentials`）
2. 响应有 `Access-Control-Allow-Credentials: true`，且 `Access-Control-Allow-Origin` 是**具体域名**（不能是 `*`）
3. 写操作带上 CSRF 头，否则别人的页面也能「借」你的 Cookie 发 POST

`credentials: true` 时 **必须显式配 `origin`**，不能再靠无参 cors() 的默认反射——启动期就会抛错。CSRF 用双提交 Cookie：可读 Cookie `csrfToken` 与请求头 `x-csrf-token` 一致才放行。

```typescript
import { cors } from '@aomex/cors';
import { csrf } from '@aomex/csrf';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
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
本地分端口调试时，把 origin 换成 `http://localhost:5173`（或你的前端地址），不要用 `*`。同站部署（前后端同 origin）可以省略 cors()，但 CSRF 建议仍挂着。
:::

挂载顺序：cors → csrf → routers。两者都要在 routers **之前**，错误响应才会带上 CORS / 刚签发的 CSRF Cookie。

前端每次改数据的请求大致是：

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

GET 等安全方法默认不校验 CSRF；首次访问会先签发 `csrfToken` Cookie（`HttpOnly=false`，JS 可读）。细则见 [CSRF](/zh/plugins/csrf)。

## store、cookie 与 onLoaded

`cookie.maxAge`（秒）必填，同时作为缓存 TTL。`onLoaded` 把存进 cache 的 Stored 收成业务身份；用户已注销可返回 `false` → **401**。

```typescript
import { Auth } from '@aomex/auth';
import { AuthSessionStrategy } from '@aomex/auth/session';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import { body, Router } from '@aomex/web';
import { rule } from '@aomex/common';

const auth = new Auth({
  strategies: {
    session: new AuthSessionStrategy({
      store: new CacheMemoryAdapter(), // [!code highlight]
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

生产或多实例请换成 Redis 等外置适配器，见 [缓存](/zh/core/cache)。Cookie 默认名 `sessionId`；`setCookie` 默认 `httpOnly: true`、`sameSite: Strict`（跨站前端要改成 `'none'` 并开 `secure`）。

| 选项 | 什么时候用 |
| --- | --- |
| `store` | 会话落点；本机 memory，多副本 Redis |
| `cookie.maxAge` | 会话多久失效（秒）；**必填** |
| `cookie.name` / `path` / `domain` / `sameSite` / `secure` | 与前端域名、是否跨站对齐 |
| `sliding` | 每次认证成功续期 TTL + Cookie；活跃用户少被迫下线 |
| `generateCacheKey` | 自定义键前缀；默认 `auth:session:${sessionId}` |
| `onLoaded` | Stored → 业务身份；查库、吊销 |
| `onAuthorize` | 需要 `authorize(角色)` 时再写 |

## 登录、鉴权、退出

登录路由**不要**挂 `authenticate`。用 `strategy.login(ctx, stored)` 写缓存并设 Cookie（签发新的 `sessionId`；若请求已带旧 Cookie，写入成功后删掉旧会话）。私有接口挂 `authenticate('session')`，读 `ctx.auth.session`。

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

认证成功后：

```typescript
ctx.auth.session // { sessionId: string; data: Loaded }
```

`data` 是 `onLoaded` 的返回值。`logout` 删缓存并清 Cookie；`touch` 只续期不改存储内容。提权或敏感操作后再轮换 id 时，调用 `regenerateSessionId(ctx)`（也可顺带传入新的 Stored）。

::: warning
跨域时前端必须 `credentials: 'include'`，否则浏览器不会带上 `sessionId` Cookie，看起来像「登录成功但立刻 401」。
:::

## 与 Bearer / JWT 怎么选

| | Session | Bearer / JWT |
| --- | --- | --- |
| 凭证放哪 | HttpOnly Cookie | 头 / 本地存储 |
| 跨域 | 要 CORS credentials + 常要 CSRF | 一般只带 `Authorization` |
| 吊销 | 删缓存即可 | Bearer 删会话；JWT 靠短 TTL / 黑名单 |
| 典型客户端 | 浏览器 SPA / 管理台 | App、开放平台、服务间 |

同站管理台优先 Session；开放 API 优先 Bearer 或 JWT。总入口见 [身份认证](/zh/plugins/auth)。

## 相关

- [跨域 CORS](/zh/plugins/cors)
- [CSRF](/zh/plugins/csrf)
- [身份认证](/zh/plugins/auth)
- [缓存](/zh/core/cache)
- [Bearer 策略](/zh/plugins/auth-bearer-strategy)
