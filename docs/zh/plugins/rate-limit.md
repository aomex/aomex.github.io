---
outline: deep
---

# 请求限流

在时间窗内按客户端标识计数，超限返回 **429**，用来挡刷接口和突发流量。

**按 IP / 连接的全站限流，生产优先用 Nginx**（如 `limit_req_zone` / `limit_req`）：请求还没进 Node 就被挡住，多副本也不用先上 Redis。`@aomex/rate-limit` 更适合：**按用户 / API Key 等业务键**、登录短信等单路由收紧，或本地没有反代时先顶一阵。

默认**进程内内存**计数——单机够用；多副本且必须在应用内计数时要换 Redis，否则总限额约等于 `maxRequest × 实例数`。

```bash
pnpm add @aomex/rate-limit
# 多实例且必须在应用内共享计数：
pnpm add @aomex/rate-limit-redis-store
```

## 全站挂载

边缘已经按 IP 限过的话，应用里不必再挂一层全站 `rateLimit()`。需要按业务键、或本地直连时，把 `rateLimit()` 放在 mount 靠前：窗口内超限直接 **429**，不必在每个 action 里数次数。多副本共享计数要换 Redis store，见下文。

```typescript
import { rateLimit } from '@aomex/rate-limit';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:7]
    rateLimit({
      maxRequest: 100,
      duration: 60_000, // [!code highlight]
    }),
    routers('./src/routers'),
  ],
});
```

普通 WebMiddleware；超限抛 HTTP 错误，状态 **429**，不必在每条 action 里手写判断。id 返回 false 表示本条不计数（健康检查常用）。

## 计数键与白名单

| 选项 | 什么时候用 | 默认 |
| --- | --- | --- |
| `duration` | 窗口长短 | 1 小时 |
| `maxRequest` | 窗口内允许次数 | 2500 |
| `id` | 按 API Key / 用户；`false` 豁免 | IP |
| `allowList` / `denyList` | 内网跳过；封禁 IP | — |
| `store` | **多实例必换** Redis 等 | 内存 |

### 按 Key / 用户，放过健康检查

```typescript
rateLimit({
  maxRequest: 60,
  duration: 60_000,
  id: (ctx) => { // [!code highlight]
    if (ctx.request.pathname === '/health') {
      return false;
    }
    const key = ctx.request.headers['x-api-key'];
    if (typeof key === 'string') {
      return key;
    }
    return ctx.request.ip;
  },
  allowList: (ctx) => {
    return ctx.request.ip === '127.0.0.1';
  },
});
```

### 只限单条路由

```typescript
import { body } from '@aomex/web';
import { rule } from '@aomex/common';

router.post('/login', {
  mount: [
    rateLimit({ maxRequest: 10, duration: 60_000 }), // [!code highlight]
    body({ email: rule.email(), password: rule.string() }),
  ],
  action: async (ctx) => {
    /* ... */
  },
});
```

### 生产多副本：Redis

构造时只传 `RedisOptions`（`host` / `port` 等；类型可从本包引入），不要传入已建好的 `Redis` 实例。`ioredis` 已随 `@aomex/rate-limit-redis-store` 装好，不必再单独加依赖。store 内部会 `lazyConnect`，由 `rateLimit()` 经 [`registerLifecycle`](/zh/core/service#生命周期钩子) 在进程侧连上 / 断开。

```typescript
import { RateLimitRedisStore } from '@aomex/rate-limit-redis-store';

rateLimit({
  store: new RateLimitRedisStore({ // [!code highlight]
    host: '127.0.0.1',
    port: 6379,
  }),
  maxRequest: 500,
  duration: 3_600_000,
  id: (ctx) => {
    const key = ctx.request.headers['x-api-key'];
    if (typeof key === 'string') {
      return key;
    }
    return ctx.request.ip;
  },
});
```

默认内存 store 也可从 `@aomex/rate-limit/memory` 显式引入；关停时会清空进程内计数。

| 环境 | 建议 |
| --- | --- |
| 本地直连 | 可挂应用限流，限额松一点，避免刷接口把自己锁死 |
| 生产有 Nginx | **优先** `limit_req` 等做 IP / 连接限流；应用层留给登录、短信、按 Key 的配额 |
| 生产多 Pod + 应用内计数 | **必须**共享 `store`（Redis）；别和网关用同一套过紧的 IP 限额叠到误伤 |

自建存储需实现包内 `RateLimitStore` 的原子 `getAndSet`；需要连库 / 关连接时可覆盖 `onInit` / `onDestroy`（`rateLimit()` 会自动登记）。签名以类型定义为准。

只按 IP 限流时，NAT 后面整栋办公楼共用一个键，容易误伤；登录等接口更适合按用户或 API Key。全站限额过紧时，热点路由单独 mount 更常见。

## 下一步

- 蜜罐 / 错误累计 / 封 IP：[滥用防护](/zh/plugins/abuse)
- 真实 IP（限流键）：[应用入口](/zh/web/) 里 proxyIP
- 身份维度：[Auth](/zh/plugins/auth)
- 错误形态：[错误格式](/zh/web/errors)