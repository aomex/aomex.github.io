# 快取

做一個 **CacheService**：選 memory / file / Redis 介面卡，用 this.cache 讀寫；用登入 **session**（token → 使用者資訊）跑通「簽發、鑑權讀、退出刪」整條鏈。

子類實現 createAdapter()；業務 key 用 protected readonly + this.concat 集中管理，避免散落字串。

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

`get<T>(key)` 帶上泛型後，返回值型別上是 `T | null`；set 第三參是過期**毫秒**，`this.ttl.DAY`、`this.ttl.MINUTE` 用來少寫魔法數字。`services.cache.xxx` 的方法名、引數跟你在 CacheService 裡宣告的一致，改簽名時編譯器會追著路由和鑑權回撥改。

註冊並預熱（生產換 Redis 時尤其建議 eager）：

```typescript
await combineServices(
  {
    cache: () => import('./cache.service.js'),
  },
  { eager: ['cache'] }, // [!code highlight]
);
```

::: warning
生產或多例項時 cache 沒寫 eager，首個讀快取的請求還要付連 Redis 的時間，尾延遲容易抖。
:::

## session 讀寫

登入簽發 token 後，把「token → 使用者資訊」寫入快取；鑑權 onLoaded 裡讀回；退出時 delete。鍵名用 `this.concat` 加版本字首，發版換會話結構時改一處即可整批失效。

業務側（登入 / 鑑權 / 退出）：

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

簽發 token、查庫這類邏輯留在 User / Auth 等 Service；CacheService 只負責存取。

## memory 與 Redis

介面卡決定資料落在哪：**memory** 零依賴、程序內、重啟清空，適合本機和單測；**Redis** 多例項共享 session、限流計數；需要一點磁碟持久化可看 **file**。業務程式碼通常只改 `createAdapter()`，讀寫 API 不變。

本地開發、單測用 @aomex/cache/memory，零依賴，重啟丟資料：

```typescript
import { CacheMemoryAdapter } from '@aomex/cache/memory';

protected createAdapter() {
  return new CacheMemoryAdapter();
}
```

生產或多例項共享 session / 限流時換 `@aomex/cache-redis-adapter`，一般只改 createAdapter：

```typescript
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

protected createAdapter() {
  return new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 });
}
```

單機要一點持久化可選 @aomex/cache/file。

## key 命名與版本

`protected readonly` 欄位集中業務字首（如 `login-token`），`this.concat` 拼 token 或 id，避免方法裡散落魔術字串。把版本號寫進字首（`v1` → `v2`）等於**不重名地**廢棄舊 session，發版換載荷時常用。

改 v1 → v2 等於整批 key 失效，發版換 session 時常用：

```typescript
protected readonly loginTokenKey = this.concat('login-token', 'v2');
```

別在各個方法裡散落版本字串，用類上 readonly 字首 + this.concat。

## setNX 與計數

`setNX` 在 key 不存在時寫入，用來做分散式鎖、冪等「只處理一次」；TTL 要覆蓋任務最壞耗時，否則鎖過期後可能被第二個 worker 搶走。`increment` / `expire` 適合驗證碼錯誤次數、滑動視窗計數。

搶鎖、冪等（TTL 要大於任務最壞耗時）：

```typescript
const ok = await this.cache.setNX(lockKey, '1', 30_000);
if (ok) {
  await this.cache.expire(lockKey, 30_000);
}
```

驗證碼錯誤次數等視窗計數用 increment / expire。

## 方法裝飾器 @remember

讀多寫少、結果可短暫快取的查詢，不想每條都手寫 get → miss → set 時，在**業務 Service** 方法上掛 `@remember`。先在 CacheService.onInit 裡 `remember.setInstance(this)`，並配合 `eager: ['cache']`，關停時 `deleteInstance`。

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
有副作用的寫操作別加；失效仍要自己 delete 或換 key 版本。@remember 用在會改資料的方法上會快取舊結果，要自己設計失效策略。
:::

## 下一步

- 服務註冊與 eager：[服務層](/zh-TW/core/service)
- 鑑權裡怎麼用 session：[統一入口 Auth](/zh-TW/plugins/auth)
- Bearer 與 token 策略：[Bearer 策略](/zh-TW/plugins/auth-bearer-strategy)