# 缓存

做一个 **CacheService**：选 memory / file / Redis 适配器，用 this.cache 读写；用登录 **session**（token → 用户信息）跑通「签发、鉴权读、退出删」整条链。

子类实现 createAdapter()；业务 key 用 protected readonly + this.concat 集中管理，避免散落字符串。

```typescript
import { BaseCacheService } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export default class CacheService extends BaseCacheService { // [!code focus:28]
  protected readonly loginTokenKey = this.concat('login-token', 'v1');

  protected createAdapter() {
    return new CacheMemoryAdapter(); // [!code highlight]
  }

  async getLoginToken(token: string) {
    return this.cache.get<{ userId: number; role: number }>(
      this.concat(this.loginTokenKey, token),
    );
  }

  async setLoginToken(
    token: string,
    session: { userId: number; role: number },
  ) {
    await this.cache.set(
      this.concat(this.loginTokenKey, token),
      session,
      this.ttl.DAY * 7,
    );
  }

  async deleteLoginToken(token: string) {
    await this.cache.delete(this.concat(this.loginTokenKey, token));
  }
}
```

`get<T>(key)` 带上泛型后，返回值类型上是 `T | null`；set 第三参是过期**毫秒**，`this.ttl.DAY`、`this.ttl.MINUTE` 用来少写魔法数字。`services.cache.xxx` 的方法名、参数跟你在 CacheService 里声明的一致，改签名时编译器会追着路由和鉴权回调改。

注册并预热（生产换 Redis 时尤其建议 eager）：

```typescript
await combineServices(
  {
    cache: () => import('./cache.service.js'),
  },
  { eager: ['cache'] }, // [!code highlight]
);
```

::: warning
生产或多实例时 cache 没写 eager，首个读缓存的请求还要付连 Redis 的时间，尾延迟容易抖。
:::

## session 读写

登录签发 token 后，把「token → 用户信息」写入缓存；鉴权 onLoaded 里读回；退出时 delete。键名用 `this.concat` 加版本前缀，发版换会话结构时改一处即可整批失效。

业务侧（登录 / 鉴权 / 退出）：

```typescript
// 登录成功后写入
const token = auth.strategy('bearer').signature('sha256', user.id);
await services.cache.setLoginToken(token, {
  userId: user.id,
  role: user.role,
}); // [!code highlight]

// 鉴权 onLoaded 里读取
const session = await services.cache.getLoginToken(token);
if (!session) {
  return false;
}

// 退出登录删掉
await services.cache.deleteLoginToken(token);
```

签发 token、查库这类逻辑留在 User / Auth 等 Service；CacheService 只负责存取。

## memory 与 Redis

适配器决定数据落在哪：**memory** 零依赖、进程内、重启清空，适合本机和单测；**Redis** 多实例共享 session、限流计数；需要一点磁盘持久化可看 **file**。业务代码通常只改 `createAdapter()`，读写 API 不变。

本地开发、单测用 @aomex/cache/memory，零依赖，重启丢数据：

```typescript
import { CacheMemoryAdapter } from '@aomex/cache/memory';

protected createAdapter() {
  return new CacheMemoryAdapter();
}
```

生产或多实例共享 session / 限流时换 `@aomex/cache-redis-adapter`，一般只改 createAdapter：

```typescript
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

protected createAdapter() {
  return new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 });
}
```

单机要一点持久化可选 @aomex/cache/file。

## key 命名与版本

`protected readonly` 字段集中业务前缀（如 `login-token`），`this.concat` 拼 token 或 id，避免方法里散落魔术字符串。把版本号写进前缀（`v1` → `v2`）等于**不重名地**废弃旧 session，发版换载荷时常用。

改 v1 → v2 等于整批 key 失效，发版换 session 时常用：

```typescript
protected readonly loginTokenKey = this.concat('login-token', 'v2');
```

别在各个方法里散落版本字符串，用类上 readonly 前缀 + this.concat。

## setNX 与计数

`setNX` 在 key 不存在时写入，用来做分布式锁、幂等「只处理一次」；TTL 要覆盖任务最坏耗时，否则锁过期后可能被第二个 worker 抢走。`increment` / `expire` 适合验证码错误次数、滑动窗口计数。

抢锁、幂等（TTL 要大于任务最坏耗时）：

```typescript
const ok = await this.cache.setNX(lockKey, '1', 30_000);
if (ok) {
  await this.cache.expire(lockKey, 30_000);
}
```

验证码错误次数等窗口计数用 increment / expire。

## 方法装饰器 @remember

读多写少、结果可短暂缓存的查询，不想每条都手写 get → miss → set 时，在**业务 Service** 方法上挂 `@remember`。先在 CacheService.onInit 里 `remember.setInstance(this)`，并配合 `eager: ['cache']`，关停时 `deleteInstance`。

```typescript
protected override async onInit() {
  await super.onInit();
  remember.setInstance(this); // [!code highlight]
}

protected override async onDestroy() {
  remember.deleteInstance(); // [!code highlight]
  await super.onDestroy();
}
```

```typescript
class ReportService extends Service {
  @remember(60_000)
  async build(id: number) {
    return heavyCompute(id);
  }

  @remember({ // [!code highlight]
    duration: 60_000,
    key: (id) => {
      return `report:${id}`;
    },
    defaultValue: null,
  })
  async find(id: number) {
    return db.report.find(id);
  }
}
```

::: warning
有副作用的写操作别加；失效仍要自己 delete 或换 key 版本。@remember 用在会改数据的方法上会缓存旧结果，要自己设计失效策略。
:::

## 下一步

- 服务注册与 eager：[服务层](/zh/core/service)
- 鉴权里怎么用 session：[统一入口 Auth](/zh/plugins/auth)
- Bearer 与 token 策略：[Bearer 策略](/zh/plugins/auth-bearer-strategy)