# 快取

做一個 **CacheService**：選 memory / file / Redis 介面卡，用 this.cache 讀寫；用登入 **session**（token → 使用者資訊）跑通「簽發、鑑權讀、退出刪」整條鏈。

子類實現 createAdapter()；業務字首用 `protected readonly` + `this.key(...)` 收成 `CacheKey`，方法裡再 `.key(token)` 往下拼，避免散落字串。

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
      this.ttl.DAY * 7,
    );
  }

  async deleteLoginToken(token: string) {
    await this.cache.delete(this.loginTokenKey.key(token));
  }
}
```

`get` / `set` / `delete` 等接受 **字串或 `CacheKey`**。`get<T>(key)` 帶上泛型後，返回值型別上是 `T | null`；set 第三參是過期**毫秒**，`this.ttl.DAY`、`this.ttl.MINUTE` 用來少寫魔法數字。`services.cache.xxx` 的方法名、引數跟你在 CacheService 裡宣告的一致，改簽名時編譯器會追著路由和鑑權回撥改。
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

登入簽發 token 後，把「token → 使用者資訊」寫入快取；鑑權 onLoaded 裡讀回；退出時 delete。鍵名用帶版本的 `CacheKey` 字首，發版換會話結構時改一處即可整批失效。

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

## 介面卡選擇

介面卡決定資料落在哪：**memory** 零依賴、程序內、重啟清空，適合本機和單測；**Redis** 多例項共享 session、限流計數；需要一點磁碟持久化可看 **file**。業務程式碼通常只改 `createAdapter()`，讀寫 API 不變。

本地開發、單測用 @aomex/cache/memory，零依賴，重啟丟資料：

```typescript
import { CacheMemoryAdapter } from '@aomex/cache/memory';

protected createAdapter() {
  return new CacheMemoryAdapter();
}
```

生產或多例項共享 session / 限流時換 `@aomex/cache-redis-adapter`（`ioredis` 已隨包裝好，一般只改 createAdapter）：

```typescript
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

protected createAdapter() {
  return new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 });
}
```

單機要一點持久化可選 @aomex/cache/file。

## 鍵怎麼拼：CacheKey

`this.key(...)` 返回的是 **`CacheKey`**，不是普通字串：片段用 `:` 拼接，可以繼續 `.key` / `.keyHash` / `.toHash()`。`this.cache.get` / `set` 等直接吃它，不必再 `String(...)`。

```typescript
this.key('user', 1); // user:1
this.key('user').key(1); // 同上
this.key('user').keyHash(1); // user:<md5('1')>，前缀可读
this.key('user', 1).toHash(); // <md5('user:1')>
this.keyHash('user', 1); // 同上，整键哈希
```

| 寫法 | 得到什麼 |
| --- | --- |
| `this.key('a', 1)` | 可讀鍵 `a:1` |
| `prefix.key(id)` | 在已有 `CacheKey` 字首後再拼一段 |
| `this.key('a').keyHash(id)` | 字首保留，**只雜湊本次引數** |
| `this.key(...).toHash()` / `this.keyHash(...)` | **整段** MD5，無可讀字首 |

片段過長、含奇怪字元、或不想在 Redis 裡露出明文時用雜湊；日常業務鍵留可讀字首更方便排查。舊的單獨 `hash()` 已去掉，統一走上面幾條。

### 字首與版本

`protected readonly` 欄位集中業務字首（如 `login-token`），方法裡再 `.key(token)` / `.key(id)`，別在各處手寫魔術字串。把版本號寫進字首（`v1` → `v2`）等於**不重名地**廢棄舊 session：

```typescript
protected readonly loginTokenKey = this.key('login-token', 'v2');
```

## exists：只要有沒有

只想知道某個鍵**在不在**、不必把值讀出來解碼時，用 `exists`。返回 `boolean`，同樣接受字串或 `CacheKey`。

```typescript
const key = this.loginTokenKey.key(token);
if (await this.cache.exists(key)) {
  // 会话还在，再决定要不要 get 详情
}
```

和 `get` 的差別：`get` 未命中時是 `null`（你還要自己判斷），並把值反序列化一遍；`exists` 只問介面卡「這個鍵還在嗎」。適合佔位標記、鎖是否還握著、或先探一下再決定要不要拉大物件。

::: tip
「先 exists 再 get」兩步之間別人可能刪掉或改掉鍵，別拿它當嚴謹的事務條件。搶鎖、冪等仍用下面的 `setNX`。
:::

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

## 快取裝飾器

業務方法裡反覆寫「先 get → 沒有再算 → set」很囉嗦，同一 key 併發打進來還會算很多次。`createRemember` 做出一個方法裝飾器 `@remember`：命中直接返回；未命中才跑原方法並寫入；**同一 key 併發時只讓一個執行**，其餘等結果。

裝飾器要綁在你自己的快取服務類上——傳入 `BaseCacheService` **子類建構函式**（不能傳基類、不能傳例項）。寫在 `cache.service.ts` 裡最省事，業務側直接 import `remember`：

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

`BaseCacheService` 在 `onInit` 連上介面卡後會自動掛好這條 remember，關停時卸下——你**不用**再手調登記。`combineServices` 裡仍建議 `eager: ['cache']`：快取還沒就緒時，被裝飾的方法會**等**；已經關停後再調會**拋錯**。

### 掛到業務方法

方法必須是 **async**（返回 Promise）。只傳毫秒數時，等於「快取多久」：

```typescript
import { Service } from '@aomex/common';
import { remember } from './cache.service.js';

class ReportService extends Service {
  @remember(60_000)
  async build(id: number) {
    return heavyCompute(id);
  }
}
```

要自定義 key 或預設值時改傳物件；這時 `await services.report.find(1)` 的第一次會進庫，視窗內再調同參就讀快取。`duration` 是寫入後的過期**毫秒**：

```typescript
class ReportService extends Service {
  @remember({ // [!code focus:8]
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

| 寫法 | 幹什麼 |
| --- | --- |
| `@remember(60_000)` | 只定過期時間；key 用預設規則 |
| `duration` | 必填（物件寫法裡）；快取多久 |
| `key: '固定串'` | 整方法共用一個鍵（無參、全站單例結果） |
| `key: (...args) => string` | 按引數拼鍵；`this` 仍是業務例項 |
| `defaultValue` | 原方法返回 `null` 時，對外換成這個值（預設仍是 `null`） |

### 預設 key 怎麼拼

沒寫 `key` 時，框架用：

`類名或 displayName` + `-` + `方法名` + `-` + `JSON.stringify(引數)`

繼承 `Service` 且類名以 `Service` 結尾時，會用去掉字尾的 `displayName`（`ReportService` → `Report`），避免鍵裡一長串字尾。引數會進 JSON，**別塞不可序列化或會抖的值**（`Date`、迴圈引用、每次不同的物件字面量），否則 key 對不上、等於沒快取。引數多或結構亂時，自己寫 `key` 更穩。

### 併發與空結果

同一 key 打進來時，第一個用 `setNX` 佔位去跑原方法，佔位鍵大約 20 秒、執行中會續期；其它呼叫輪詢等到佔位消失，再讀快取（或拿到 `defaultValue`）。這是防快取擊穿用的，不是分散式鎖業務語義——別拿它當通用鎖。

原方法返回 `null` 時**不會**把 `null` 寫進快取（避免把「沒有」鎖死太久）；呼叫方看到的是 `defaultValue`。真要快取「明確沒有」這類結果，需要你自己設計鍵或換手寫 `this.cache.set`。

### 多套快取

本機 memory 一套、共享 Redis 一套時：各寫一個 `BaseCacheService` 子類，再各調一次 `createRemember`。作用域按**服務類**區分，沒有 `fork()`。業務方法上掛哪份 `remember`，就進哪套儲存。

::: warning
只掛**讀多寫少、可短暫過期**的查詢。寫庫、發簡訊、扣庫存這類有副作用的方法別加——快取裡會是舊結果。資料變了要失效時，自己 `cache.delete` 對應鍵，或換 key 版本（見上文「鍵怎麼拼」）。
:::

## 下一步

- 服務註冊與 eager：[服務層](/zh-TW/core/service)
- 鑑權裡怎麼用 session：[統一入口 Auth](/zh-TW/plugins/auth)
- Bearer 與 token 策略：[Bearer 策略](/zh-TW/plugins/auth-bearer-strategy)