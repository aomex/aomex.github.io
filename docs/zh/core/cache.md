# 缓存

做一个 **CacheService**：选 memory / file / Redis 适配器，用 this.cache 读写；用登录 **session**（token → 用户信息）跑通「签发、鉴权读、退出删」整条链。

子类实现 createAdapter()；业务前缀用 `protected readonly` + `this.key(...)` 收成 `CacheKey`，方法里再 `.key(token)` 往下拼，避免散落字符串。

```typescript
import { BaseCacheService } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export default class CacheService extends BaseCacheService { // [!code focus:28]
  protected readonly loginTokenKey = this.key('login-token', 'v1');

  protected createAdapter() {
    return new CacheMemoryAdapter(); // [!code highlight]
  }

  async getLoginToken(token: string) {
    return this.cache.get<{ userId: number; role: number }>(
      this.loginTokenKey.key(token),
    );
  }

  async setLoginToken(
    token: string,
    session: { userId: number; role: number },
  ) {
    await this.cache.set(
      this.loginTokenKey.key(token),
      session,
      '7 days',
    );
  }

  async deleteLoginToken(token: string) {
    await this.cache.delete(this.loginTokenKey.key(token));
  }
}
```

`get` / `set` / `delete` 等接受 **字符串或 `CacheKey`**。`get<T>(key)` 带上泛型后，返回值类型上是 `T | null`；`set` / `setNX` / `expire` 的过期时间是 **`DurationInput`**：毫秒数或可读字符串（`'7 days'`、`'30m'`、`'1.5 hours'`），见下文。`services.cache.xxx` 的方法名、参数跟你在 CacheService 里声明的一致，改签名时编译器会追着路由和鉴权回调改。

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

登录签发 token 后，把「token → 用户信息」写入缓存；鉴权 onLoaded 里读回；退出时 delete。键名用带版本的 `CacheKey` 前缀，发版换会话结构时改一处即可整批失效。

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

## 适配器选择

适配器决定数据落在哪：**memory** 零依赖、进程内、重启清空，适合本机和单测；**Redis** 多实例共享 session、限流计数；需要一点磁盘持久化可看 **file**。业务代码通常只改 `createAdapter()`，读写 API 不变。

本地开发、单测用 @aomex/cache/memory，零依赖，重启丢数据：

```typescript
import { CacheMemoryAdapter } from '@aomex/cache/memory';

protected createAdapter() {
  return new CacheMemoryAdapter();
}
```

生产或多实例共享 session / 限流时换 `@aomex/cache-redis-adapter`（`ioredis` 已随包装好，一般只改 createAdapter）：

```typescript
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

protected createAdapter() {
  return new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 });
}
```

单机要一点持久化可选 @aomex/cache/file。

## 键怎么拼：CacheKey

`this.key(...)` 返回的是 **`CacheKey`**，不是普通字符串：片段用 `:` 拼接，可以继续 `.key` / `.keyHash` / `.toHash()`。`this.cache.get` / `set` 等直接吃它，不必再 `String(...)`。

```typescript
this.key('user', 1); // user:1
this.key('user').key(1); // 同上
this.key('user').keyHash(1); // user:<md5('1')>，前缀可读
this.key('user', 1).toHash(); // <md5('user:1')>
this.keyHash('user', 1); // 同上，整键哈希
```

| 写法 | 得到什么 |
| --- | --- |
| `this.key('a', 1)` | 可读键 `a:1` |
| `prefix.key(id)` | 在已有 `CacheKey` 前缀后再拼一段 |
| `this.key('a').keyHash(id)` | 前缀保留，**只哈希本次参数** |
| `this.key(...).toHash()` / `this.keyHash(...)` | **整段** MD5，无可读前缀 |

片段过长、含奇怪字符、或不想在 Redis 里露出明文时用哈希；日常业务键留可读前缀更方便排查。旧的单独 `hash()` 已去掉，统一走上面几条。

### 前缀与版本

`protected readonly` 字段集中业务前缀（如 `login-token`），方法里再 `.key(token)` / `.key(id)`，别在各处手写魔术字符串。把版本号写进前缀（`v1` → `v2`）等于**不重名地**废弃旧 session：

```typescript
protected readonly loginTokenKey = this.key('login-token', 'v2');
```

## 时长 DurationInput

过期时间不必再手写 `60_000`。`set` / `setNX` / `expire`，以及 `@remember` 的 `duration`，都接受：

- **number**：毫秒（与以前一样）
- **字符串**：数字 + 单位，空格可选——`'30m'`、`'1 hour'`、`'7 days'`

常用单位：`ms` / `s`（`sec` / `second`）/ `m`（`min` / `minute`）/ `h`（`hr` / `hour`）/ `d`（`day`）/ `w`（`week`）/ `month` / `y`（`year`）。`month` 按 30 天、`year` 按 365 天。也可直接 `import { parseDuration } from '@aomex/common'`，在别处把可读时长换成毫秒。

```typescript
await this.cache.set(key, session, '7 days');
await this.cache.setNX(lockKey, '1', '30 seconds');
await this.cache.expire(key, '1 hour');
```

## exists：只要有没有

只想知道某个键**在不在**、不必把值读出来解码时，用 `exists`。返回 `boolean`，同样接受字符串或 `CacheKey`。

```typescript
const key = this.loginTokenKey.key(token);
if (await this.cache.exists(key)) {
  // 会话还在，再决定要不要 get 详情
}
```

和 `get` 的差别：`get` 未命中时是 `null`（你还要自己判断），并把值反序列化一遍；`exists` 只问适配器「这个键还在吗」。适合占位标记、锁是否还握着、或先探一下再决定要不要拉大对象。

::: tip
「先 exists 再 get」两步之间别人可能删掉或改掉键，别拿它当严谨的事务条件。抢锁、幂等仍用下面的 `setNX`。
:::

## setNX 与计数

`setNX` 在 key 不存在时写入，用来做分布式锁、幂等「只处理一次」；TTL 要覆盖任务最坏耗时，否则锁过期后可能被第二个 worker 抢走。`increment` / `expire` 适合验证码错误次数、固定窗口计数。

抢锁、幂等（TTL 要大于任务最坏耗时）：

```typescript
const ok = await this.cache.setNX(lockKey, '1', '30 seconds');
if (!ok) {
  return;
}
```

验证码错误次数：先 `increment`，首次（或尚未设过期）再 `expire` 拉开窗口——与 Redis `INCR` 习惯一致。memory 适配器的自增 / 自减会**保留已有 TTL**，不会因为改数字把过期清掉。

```typescript
const key = this.key('otp-fail', phone);
const n = await this.cache.increment(key);
if (n === 1 || (await this.cache.ttl(key)) === -1) {
  await this.cache.expire(key, '15 minutes'); // [!code highlight]
}
if (n > 5) {
  ctx.throw(429);
}
```

## 缓存装饰器

业务方法里反复写「先 get → 没有再算 → set」很啰嗦，同一 key 并发打进来还会算很多次。`createRemember` 做出一个方法装饰器 `@remember`：命中直接返回；未命中才跑原方法并写入；**同一 key 并发时只让一个执行**，其余等结果。

装饰器要绑在你自己的缓存服务类上——传入 `BaseCacheService` **子类构造函数**（不能传基类、不能传实例）。写在 `cache.service.ts` 里最省事，业务侧直接 import `remember`：

```typescript
import { BaseCacheService, createRemember } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export default class CacheService extends BaseCacheService {
  protected createAdapter() {
    return new CacheMemoryAdapter();
  }
}

export const remember = createRemember(CacheService); // [!code highlight]
```

`BaseCacheService` 在 `onInit` 连上适配器后会自动挂好这条 remember，关停时卸下——你**不用**再手调登记。`combineServices` 里仍建议 `eager: ['cache']`：缓存还没就绪时，被装饰的方法会**等**；已经关停后再调会**抛错**。

### 挂到业务方法

方法必须是 **async**（返回 Promise）。只传时长时，等于「缓存多久」（`DurationInput`）：

```typescript
import { Service } from '@aomex/common';
import { remember } from './cache.service.js';

class ReportService extends Service {
  @remember('1 minute')
  async build(id: number) {
    return heavyCompute(id);
  }
}
```

要自定义 key 或缺省值时改传对象；这时 `await services.report.find(1)` 的第一次会进库，窗口内再调同参就读缓存。`duration` 仍是写入后的过期时间：

```typescript
class ReportService extends Service {
  @remember({ // [!code focus:8]
    duration: '1 minute',
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

| 写法 | 干什么 |
| --- | --- |
| `@remember('1 minute')` / `@remember(60_000)` | 只定过期时间；key 用默认规则 |
| `duration` | 必填（对象写法里）；缓存多久 |
| `key: '固定串'` | 整方法共用一个键（无参、全站单例结果） |
| `key: (...args) => string` | 按参数拼键；`this` 仍是业务实例 |
| `defaultValue` | 原方法返回 `null` 时，对外换成这个值（默认仍是 `null`） |

### 默认 key 怎么拼

没写 `key` 时，框架用：

`类名或 displayName` + `-` + `方法名` + `-` + `JSON.stringify(参数)`

继承 `Service` 且类名以 `Service` 结尾时，会用去掉后缀的 `displayName`（`ReportService` → `Report`），避免键里一长串后缀。参数会进 JSON，**别塞不可序列化或会抖的值**（`Date`、循环引用、每次不同的对象字面量），否则 key 对不上、等于没缓存。参数多或结构乱时，自己写 `key` 更稳。

### 并发与空结果

同一 key 打进来时，第一个用 `setNX` 占位去跑原方法，占位键大约 20 秒、执行中会续期；其它调用轮询等到占位消失，再读缓存（或拿到 `defaultValue`）。这是防缓存击穿用的，不是分布式锁业务语义——别拿它当通用锁。

原方法返回 `null` 时**不会**把 `null` 写进缓存（避免把「没有」锁死太久）；调用方看到的是 `defaultValue`。真要缓存「明确没有」这类结果，需要你自己设计键或换手写 `this.cache.set`。

### 多套缓存

本机 memory 一套、共享 Redis 一套时：各写一个 `BaseCacheService` 子类，再各调一次 `createRemember`。作用域按**服务类**区分，没有 `fork()`。业务方法上挂哪份 `remember`，就进哪套存储。

::: warning
只挂**读多写少、可短暂过期**的查询。写库、发短信、扣库存这类有副作用的方法别加——缓存里会是旧结果。数据变了要失效时，自己 `cache.delete` 对应键，或换 key 版本（见上文「键怎么拼」）。
:::

## 下一步

- 服务注册与 eager：[服务层](/zh/core/service)
- 滥用计数的 `store`：[滥用防护](/zh/plugins/abuse)
- 鉴权里怎么用 session：[统一入口 Auth](/zh/plugins/auth)
- Bearer 与 token 策略：[Bearer 策略](/zh/plugins/auth-bearer-strategy)