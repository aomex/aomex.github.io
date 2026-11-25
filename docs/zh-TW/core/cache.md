# 快取

組合根建一份共享的 **`Caching`**：選 memory / file / Redis 適配器，業務與鑑權 / 濫用 / OAuth 等外掛都傳**同一實例**（配置名常見 `store`）。用登入 **session**（token → 使用者資訊）跑通「簽發、鑑權讀、退出刪」整條鏈。

類名保持 `Caching`、不要改成 `Cache`：避免和 TypeScript DOM / Web Cache API 的全域性 `Cache` 撞名。實例變數推薦叫 `cache`。首次讀寫時懶連線，關停時經內部 `registerLifecycle` 斷開。

`src/cache.ts` **只匯出** `cache` 與 `remember`；登入會話、業務鍵字首等寫在各自 Service 裡，從這裡 `import { cache }`。

```typescript
// src/cache.ts
import { Caching, createRemember } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export const cache = new Caching(new CacheMemoryAdapter()); // [!code highlight]
export const remember = createRemember(cache);
```

`get` / `set` / `delete` / `getAndDelete` / `singleFlight` 等接受 **字串或 `CacheKey`**。`get<T>(key)` 帶上泛型後，返回值型別上是 `T | null`；`set` / `setNX` / `expire` 的過期時間是 **`DurationInput`**：毫秒數或可讀字串（`'7 days'`、`'30m'`、`'1.5 hours'`），見下文。

外掛側直接傳這份實例：

```typescript
import { cache } from '@/cache';

new Abuse({ store: cache, strategies: [/* … */] });
new AuthSessionStrategy({ store: cache, /* … */ });
new OAuth2Client({ store: cache, /* … */ });
```

::: tip
別在各外掛裡各自 `new Caching(adapter)`——應組合根建立一次後共享。多套儲存（本機 memory + 共享 Redis）時再建第二份實例，並各自 `createRemember`。
:::

## session 讀寫

登入簽發 token 後，把「token → 使用者資訊」寫入快取；鑑權 onLoaded 裡讀回；退出時 delete。鍵名用帶版本的 `CacheKey` 字首，發版換會話結構時改一處即可整批失效——這些方法放在 User / Auth 等 Service 裡：

```typescript
// src/services/user.service.ts
import { Service } from '@aomex/common';
import { cache } from '@/cache';

export default class UserService extends Service {
  protected readonly loginTokenKey = cache.key('login-token', 'v1'); // [!code highlight]

  async getLoginToken(token: string) {
    return cache.get<{ userId: number; role: number }>(
      this.loginTokenKey.key(token),
    );
  }

  async setLoginToken(
    token: string,
    session: { userId: number; role: number },
  ) {
    await cache.set(this.loginTokenKey.key(token), session, '7 days');
  }

  async deleteLoginToken(token: string) {
    return cache.delete(this.loginTokenKey.key(token));
  }
}
```

業務側（登入 / 鑑權 / 退出）：

```typescript
// 登录成功后写入
const token = auth.strategy('bearer').signature('sha256', user.id);
await services.user.setLoginToken(token, {
  userId: user.id,
  role: user.role,
}); // [!code highlight]

// 鉴权 onLoaded 里读取
const session = await services.user.getLoginToken(token);
if (!session) {
  return false;
}

// 退出登录删掉
await services.user.deleteLoginToken(token);
```

## 適配器選擇

適配器決定資料落在哪：**memory** 零依賴、程序內、重啟清空，適合本機和單測；**Redis** 多實例共享 session、限流計數；需要一點磁碟持久化可看 **file**。業務程式碼通常只改構造時傳入的適配器，讀寫 API 不變。

本地開發、單測用 `@aomex/cache/memory`，零依賴，重啟丟資料：

```typescript
import { Caching } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export const cache = new Caching(new CacheMemoryAdapter());
```

生產或多實例共享 session / 限流時換 `@aomex/cache-redis-adapter`（`ioredis` 已隨包裝好）：

```typescript
import { Caching } from '@aomex/cache';
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

export const cache = new Caching(
  new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 }),
);
```

單機要一點持久化可選 `@aomex/cache/file`。

## 鍵怎麼拼：CacheKey

`cache.key(...)`（或靜態 `CacheKey.key(...)`）返回的是 **`CacheKey`**，不是普通字串：片段用 `:` 拼接，可以繼續 `.key` / `.keyHash` / `.toHash()`。`cache.get` / `set` 等直接吃它，不必再 `String(...)`。

```typescript
cache.key('user', 1); // user:1
cache.key('user').key(1); // 同上
cache.key('user').keyHash(1); // user:<md5('1')>，前缀可读
cache.key('user', 1).toHash(); // <md5('user:1')>
cache.keyHash('user', 1); // 同上，整键哈希
```

| 寫法 | 得到什麼 |
| --- | --- |
| `cache.key('a', 1)` | 可讀鍵 `a:1` |
| `prefix.key(id)` | 在已有 `CacheKey` 字首後再拼一段 |
| `cache.key('a').keyHash(id)` | 字首保留，**只雜湊本次引數** |
| `cache.key(...).toHash()` / `cache.keyHash(...)` | **整段** MD5，無可讀字首 |

片段過長、含奇怪字元、或不想在 Redis 裡露出明文時用雜湊；日常業務鍵留可讀字首更方便排查。舊的單獨 `hash()` 已去掉，統一走上面幾條。

### 字首與版本

在對應 Service 裡用 `protected readonly` 集中業務字首（如 `login-token`），方法裡再 `.key(token)` / `.key(id)`，別在各處手寫魔術字串。把版本號寫進字首（`v1` → `v2`）等於**不重名地**廢棄舊 session：

```typescript
protected readonly loginTokenKey = cache.key('login-token', 'v2');
```

## 時長 DurationInput

過期時間不必再手寫 `60_000`。`set` / `setNX` / `expire`，以及 `@remember` 的 `duration`，都接受：

- **number**：毫秒（與以前一樣）
- **字串**：數字 + 單位，空格可選——`'30m'`、`'1 hour'`、`'7 days'`

常用單位：`ms` / `s`（`sec` / `second`）/ `m`（`min` / `minute`）/ `h`（`hr` / `hour`）/ `d`（`day`）/ `w`（`week`）/ `month` / `y`（`year`）。`month` 按 30 天、`year` 按 365 天。也可直接 `import { parseDuration } from '@aomex/common'`，在別處把可讀時長換成毫秒。

```typescript
await cache.set(key, session, '7 days');
await cache.setNX(lockKey, '1', '30 seconds');
await cache.expire(key, '1 hour');
```

## exists：只要有沒有

只想知道某個鍵**在不在**、不必把值讀出來解碼時，用 `exists`。返回 `boolean`，同樣接受字串或 `CacheKey`。

```typescript
const key = loginTokenKey.key(token);
if (await cache.exists(key)) {
  // 会话还在，再决定要不要 get 详情
}
```

和 `get` 的差別：`get` 未命中時是 `null`（你還要自己判斷），並把值反序列化一遍；`exists` 只問適配器「這個鍵還在嗎」。適合佔位標記、鎖是否還握著、或先探一下再決定要不要拉大物件。

::: tip
「先 exists 再 get」兩步之間別人可能刪掉或改掉鍵，別拿它當嚴謹的事務條件。搶鎖、冪等仍用下面的 `setNX`；一次性消費見 `getAndDelete`。
:::

## getAndDelete：讀完即刪

要對齊 Redis `GETDEL`、做「一次性憑證」時，用 `getAndDelete`：原子地取出並刪除。併發兩路同時調，只有一方能拿到值，另一邊是 `null`（或你傳的預設值）。

常見場景：OAuth `state`、郵件驗證碼、短時下載票——讀到就必須作廢，防止重放。

```typescript
const ticket = await cache.getAndDelete<{ userId: number }>(
  cache.key('email-verify', code),
);
if (!ticket) {
  ctx.throw(400, '验证码无效或已使用');
}
// ticket.userId 可用；键已不在缓存里
```

和「先 `get` 再 `delete`」的差別：兩步之間別人可以再讀一次同一鍵；`getAndDelete` 在適配器層一次完成。可選第二引數當預設值（未命中時返回它，型別跟 `get` 一樣）。

## setNX 與計數

`setNX` 在 key 不存在時寫入，用來做分散式鎖、冪等「只處理一次」；TTL 要覆蓋任務最壞耗時，否則鎖過期後可能被第二個 worker 搶走。`increment` / `expire` 適合驗證碼錯誤次數、固定視窗計數。

搶鎖、冪等（TTL 要大於任務最壞耗時）：

```typescript
const ok = await cache.setNX(lockKey, '1', '30 seconds');
if (!ok) {
  return;
}
```

驗證碼錯誤次數：先 `increment`，首次（或尚未設過期）再 `expire` 拉開視窗——與 Redis `INCR` 習慣一致。memory 適配器的自增 / 自減會**保留已有 TTL**，不會因為改數字把過期清掉。

```typescript
const key = cache.key('otp-fail', phone);
const n = await cache.increment(key);
if (n === 1 || (await cache.ttl(key)) === -1) {
  await cache.expire(key, '15 minutes'); // [!code highlight]
}
if (n > 5) {
  ctx.throw(429);
}
```

## singleFlight：併發只跑一次

同一 key 上很多人同時要「現算」一份結果（拉 JWKS、打一次貴介面），又不想把結果長期塞進快取時，用 `singleFlight`：第一個進 `factory`，其餘等共享結果；**飛行結束後不留長期快取**，下次再調會重新算。

```typescript
async function loadJwks() {
  return cache.singleFlight(cache.key('jwks'), async () => { // [!code focus:3]
    return fetchJwksFromIdp();
  });
}
```

和 `@remember` 的分工：`remember` = 單飛 + **按 `duration` 寫入長期快取**；`singleFlight` = **只要這次併發共享**，算完就散。持鎖大約 30 秒、執行中會續期；失敗時等待方會收到同一錯誤。執行方崩潰且沒寫出結果時，等待方會重新競爭（有輪次上限）。

::: tip
多實例時 key 要落在共享適配器（如 Redis）上，單飛才跨程序生效；本機 memory 只護住當前程序。
:::

## 快取裝飾器

業務方法裡反覆寫「先 get → 沒有再算 → set」很囉嗦，同一 key 併發打進來還會算很多次。`createRemember` 做出一個方法裝飾器 `@remember`：命中直接返回；未命中才跑原方法並寫入；**同一 key 併發時只讓一個執行**，其餘等結果（佔位鎖與 `singleFlight` 同一套約 30 秒續期）。

裝飾器綁在**具體 `Caching` 實例**上——`createRemember(cache)`，不能傳適配器或類建構函式。在 `cache.ts` 裡匯出後，業務 Service 直接 import `remember`：

```typescript
import { Caching, createRemember } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export const cache = new Caching(new CacheMemoryAdapter());
export const remember = createRemember(cache); // [!code highlight]
```

連線由 `Caching` 懶載入負責。

### 掛到業務方法

方法必須是 **async**（返回 Promise）。只傳時長時，等於「快取多久」（`DurationInput`）：

```typescript
import { Service } from '@aomex/common';
import { remember } from '@/cache';

class ReportService extends Service {
  @remember('1 minute')
  async build(id: number) {
    return heavyCompute(id);
  }
}
```

要自定義 key 或預設值時改傳物件；這時 `await services.report.find(1)` 的第一次會進庫，視窗內再調同參就讀快取。`duration` 仍是寫入後的過期時間：

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

| 寫法 | 幹什麼 |
| --- | --- |
| `@remember('1 minute')` / `@remember(60_000)` | 只定過期時間；key 用預設規則 |
| `duration` | 必填（物件寫法裡）；快取多久 |
| `key: '固定串'` | 整方法共用一個鍵（無參、全站單例結果） |
| `key: (...args) => string` | 按引數拼鍵；`this` 仍是業務實例 |
| `defaultValue` | 原方法返回 `null` 時，對外換成這個值（預設仍是 `null`） |

### 預設 key 怎麼拼

沒寫 `key` 時，框架用：

`类名或 displayName` + `-` + `方法名` + `-` + `JSON.stringify(参数)`

繼承 `Service` 且類名以 `Service` 結尾時，會用去掉字尾的 `displayName`（`ReportService` → `Report`），避免鍵裡一長串字尾。引數會進 JSON，**別塞不可序列化或會抖的值**（`Date`、迴圈引用、每次不同的物件字面量），否則 key 對不上、等於沒快取。引數多或結構亂時，自己寫 `key` 更穩。

### 併發與空結果

同一 key 打進來時，第一個用 `setNX` 佔位去跑原方法，佔位鍵大約 30 秒、執行中會續期；其它呼叫輪詢等到佔位消失，再讀快取（或拿到 `defaultValue`）。這是防快取擊穿用的，不是分散式鎖業務語義——別拿它當通用鎖。只要「這次併發共享、不長期快取」，直接用上面的 `singleFlight`。

原方法返回 `null` 時**不會**把 `null` 寫進快取（避免把「沒有」鎖死太久）；呼叫方看到的是 `defaultValue`。真要快取「明確沒有」這類結果，需要你自己設計鍵或換手寫 `cache.set`。

### 多套快取

本機 memory 一套、共享 Redis 一套時：各 `new Caching(adapter)` 一次，再各調一次 `createRemember`。作用域按**實例**區分，沒有 `fork()`。業務方法上掛哪份 `remember`，就進哪套儲存。

::: warning
只掛**讀多寫少、可短暫過期**的查詢。寫庫、發簡訊、扣庫存這類有副作用的方法別加——快取裡會是舊結果。資料變了要失效時，自己 `cache.delete` 對應鍵，或換 key 版本（見上文「鍵怎麼拼」）。
:::

## 下一步

- 服務註冊與生命週期：[服務層](/zh-TW/core/service)
- OAuth `state` 與 `store`：[OAuth2 客戶端](/zh-TW/plugins/oauth2-client)
- 濫用計數的 `store`：[濫用防護](/zh-TW/plugins/abuse)
- 鑑權裡怎麼用 session：[統一入口 Auth](/zh-TW/plugins/auth)
- Bearer 與 token 策略：[Bearer 策略](/zh-TW/plugins/auth-bearer-strategy)
