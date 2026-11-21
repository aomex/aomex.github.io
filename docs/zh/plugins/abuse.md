---
outline: deep
---

# 滥用防护

扫目录、撞蜜罐、短时间刷 404、用假 token 试探退出——这些往往不是「正常超限」，而是在摸你的边界。`@aomex/abuse` 按策略**计数**，满额后**封 IP**（或回调你去封账号），和 [请求限速](/zh/plugins/rate-limit) 互补：限速挡突发 QPS，滥用挡探测与业务侧上报的恶意行为。

计数与封禁态落在 `@aomex/cache` 的适配器上（memory / Redis 等），多实例共享时换 Redis。依赖 `ctx.request.ip`，生产请配 `proxyIP: { mode: 'detect' }`（或固定信任链），否则全站可能只看到反代 IP。

```bash
pnpm add @aomex/abuse
# 还需已有的 @aomex/cache（及生产用的 Redis 适配器）
```

## 挂上中间件

`createAbuse` 返回值**既是中间件，也带 API**（`userAbuse` / `ipAbuse` / `blockIP` 等），**不挂到 ctx**。先建实例、再 `mount`，路由或 Service 里直接调同一个对象。

```typescript
import { createAbuse } from '@aomex/abuse';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import { routers, WebApp } from '@aomex/web';

const abuse = createAbuse({ // [!code focus:18]
  store: new CacheMemoryAdapter(),
  strategies: [
    {
      strategy: 'honeypot',
      paths: ['/.env', '/wp-admin/**'],
      limit: 1,
      window: '1 hour',
      blockFor: '1 month',
    },
    {
      strategy: 'http-error',
      statusCodes: [401, 404],
      limit: 30,
      window: '10 minutes',
      blockFor: '1 week',
    },
  ],
});

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [abuse, routers('./src/routers')], // [!code highlight]
});
```

本地 / 单测用 memory；生产多副本把 `store` 换成 Redis 适配器，否则封禁只在本机生效。`window` / `blockFor` 等时长接受毫秒数或可读字符串（如 `'1 hour'`、`'30m'`），与 [缓存](/zh/core/cache#时长-durationinput) 同一套 `DurationInput`。

请求进来时：若 IP 已封禁 → 默认 **403**；命中蜜罐且满额 → 当场封禁并 403。`http-error` 在响应结束后计数，**撞线当次仍返回原状态码**，下一请求才因封禁变 403。

## 四种策略

| 策略 | 谁在计数 | 满额做什么 |
| --- | --- | --- |
| `honeypot` | 访问了你故意放的诱饵路径 | 封 IP |
| `http-error` | 响应落在指定状态码（`throw` 或 `send`） | 封 IP |
| `ip-abuse` | 业务主动 `abuse.ipAbuse(ip, reason)` | 封 IP |
| `user-abuse` | 业务主动 `abuse.userAbuse(id, reason)` | 只回调 `onBanUser`，**不**自动封 IP |

### 蜜罐路径

路径字符串支持精确匹配、简单 glob；也可以直接写正则。正则会对 `pathname + search` 检测，便于抓带奇怪 query 的探测。`methods` 可选，未配则不限方法。

| 写法 | 匹配范围 |
| --- | --- |
| 精确串（无 `*`） | 整段 pathname 完全相等，如 `'/.env'` 不命中 `'/.env.local'` |
| `*` | **单段内**任意字符，**不跨** `/`。`'/wp-*.php'` 命中 `/wp-login.php`，不命中 `/wp/admin.php` |
| `**` | **可跨多段**。`'/a/**/c'` 命中 `/a/b/d/c`，不命中 `/a/c`（中间至少还要有一段） |
| 末尾 `/**` | 目录自身 + 任意深层子路径。`'/.git/**'` 命中 `/.git`、`/.git/config`，不误伤 `/.github` |
| `RegExp` | 测 `pathname + search`，例如 `/^\/admin\?.*dump=/` |

```typescript
{
  strategy: 'honeypot',
  paths: ['/.env', '/.env*', '/.git/**', '/wp-*.php', /^\/admin\?.*dump=/],
  methods: ['GET'],
  limit: 1,
  window: '1 hour',
  blockFor: '1 day',
}
```

glob 只看 pathname，query 不影响；要连 query 一起判用正则。`paths` 不能为空；创建时就会校验。花括号等不是扩展语法，按字面量匹配。

### 按错误状态码累计

同一策略内多个 `statusCodes` **混合累计**。可再限 `paths` / `methods`；未配则全站该状态码都算。

```typescript
{
  strategy: 'http-error',
  statusCodes: [404],
  paths: ['/api/**'],
  limit: 50,
  window: '15 minutes',
  blockFor: '2 hours',
}
```

适合挡扫接口；登录接口上的 401 若也想严管，可单独再挂一条带 `paths` 的策略，别和全站 404 混在一个桶里。

### 业务上报：IP

响应本身可能是成功（如 logout 无论 token 在不在都 204），但仍想按 IP 记「可疑试探」时，用 `ip-abuse` + 路由里调用。`reason` 用字符串即可；须与策略里声明的一致，未知 reason 运行时抛错。同一 reason 只能配一条。

```typescript
const abuse = createAbuse({
  store,
  strategies: [
    {
      strategy: 'ip-abuse',
      reason: 'logout-miss',
      limit: 5,
      window: '1 hour',
      blockFor: '6 hours',
    },
  ],
});

router.post('/logout', {
  action: async (ctx) => {
    const hit = await services.cache.deleteLoginToken(token);
    if (!hit) {
      await abuse.ipAbuse(ctx.request.ip, 'logout-miss'); // [!code highlight]
    }
    ctx.send(204);
  },
});
```

业务 reason 多了之后，也可以用 TypeScript `enum`（字符串或数字成员都行）收拢，避免魔法字符串散落。策略与 `ipAbuse` 都传枚举成员；这时第二参会收成「策略里出现过的成员」，未配置的成员、以及裸 `'logout-miss'` 都会被类型拦住。

```typescript
enum IpAbuseReason {
  LogoutMiss = 'logout-miss',
  TokenProbe = 'token-probe',
}

// strategies 里：reason: IpAbuseReason.LogoutMiss
await abuse.ipAbuse(ctx.request.ip, IpAbuseReason.LogoutMiss);
```

### 业务上报：用户

账号级滥用（刷优惠、撞库后的用户维度等）用 `user-abuse`。包内**不写用户库**——满额只调 `onBanUser`，你在回调里改库、踢 session。配置了任一 `user-abuse` 时 **`onBanUser` 必填**，创建阶段就会检查。`reason` 同样可以是字符串，也可以是 enum。

```typescript
const abuse = createAbuse({
  store,
  strategies: [
    {
      strategy: 'user-abuse',
      reason: 'order-probe',
      limit: 10,
      window: '1 day',
      banFor: '7 days', // 建议封禁时长，经回调传出
    },
  ],
  onBanUser: async (id, reason, detail) => { // [!code focus:6]
    await db.user.update({
      where: { id: Number(id) },
      data: { bannedUntil: new Date(Date.now() + (detail.banFor ?? 0)) },
    });
  },
});

await abuse.userAbuse(userId, 'order-probe');
```

用 enum 时写法与 IP 相同：策略写 `UserAbuseReason.OrderProbe`，上报与 `onBanUser` 的 `reason` 都会收成联合成员。数字 enum（如 `OrderProbe = 1`）也行；存储前会 `String(reason)`，分桶键是字符串形式。

`detail` 含 `count` / `limit`，以及解析成毫秒的 `banFor`（策略未配则为 `undefined`）。同一用户同一 reason 在窗口内只会成功触发一次 `onBanUser`（用缓存占位防并发重复）；回调抛错会放开占位，允许窗口内重试。

## 手动封禁与钩子

| API | 做什么 |
| --- | --- |
| `blockIP(ip, duration)` | 手动封 IP；已封则跳过（不刷新 TTL、不重复回调） |
| `unblockIP(ip)` | 解封 |
| `isIPBlocked(ip)` | 是否在封禁中 |
| `onBlockIP` | 策略撞线、`ipAbuse` 满额或手动 `blockIP` 时回调 |
| `bypass` | 跳过探测与封禁检查（健康检查、内网） |
| `blockedError` | 自定义被封时抛出的 `HttpError`（默认 403） |

```typescript
const abuse = createAbuse({
  store,
  strategies: [/* ... */],
  bypass: (ctx) => {
    return ctx.request.pathname === '/health';
  },
  blockedError: new HttpError(429, 'blocked', { code: 'ABUSE_BLOCKED' }),
  onBlockIP: async (ip, reason, detail) => {
    services.logger.warn('abuse.block', { ip, reason, ...detail });
  },
});

await abuse.blockIP('203.0.113.8', '1 day');
await abuse.unblockIP('203.0.113.8');
```

`onBlockIP` 的 `reason` 为 `'honeypot' | 'http-error' | 'ip-abuse' | 'manual'`；`detail.blockFor` 单位是毫秒。

::: tip
滥用封禁偏「抓到了就关一阵」；全站软限流仍看 [请求限速](/zh/plugins/rate-limit)。两者可以同时挂：限速靠前挡毛刺，滥用按策略累计后再封。
:::

## 相关

- [请求限速](/zh/plugins/rate-limit)
- [缓存](/zh/core/cache)（`store` 适配器与 `DurationInput`）
- [CSRF 防护](/zh/plugins/csrf)
