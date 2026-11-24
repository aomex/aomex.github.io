---
outline: deep
---

# 濫用防護

掃目錄、撞蜜罐、短時間刷 404、用假 token 試探退出——這些往往不是「正常超限」，而是在摸你的邊界。`@aomex/abuse` 按策略**計數**，滿額後**封 IP**（或回撥你去封賬號），和 [請求限速](/zh-TW/plugins/rate-limit) 互補：限速擋突發 QPS，濫用擋探測與業務側上報的惡意行為。

計數與封禁態落在 `@aomex/cache` 的介面卡上（memory / Redis 等），多例項共享時換 Redis。依賴 `ctx.request.ip`，生產請配 `proxyIP: { mode: 'detect' }`（或固定信任鏈），否則全站可能只看到反代 IP。

```bash
pnpm add @aomex/abuse
# 还需已有的 @aomex/cache（及生产用的 Redis 适配器）
```

## 建立並掛上 `.web()`

`new Abuse(...)` 得到的是一份**服務**（上面有 `ipAbuse` / `blockIP` 等 API），不是直接能塞進 mount 的中介軟體。HTTP 側用 `.web()` 掛到 `WebApp.mount`。業務程式碼裡繼續拿同一個 `abuse` 例項調 API，**不要**指望它出現在 `ctx` 上。

下面這份配置先掛兩條常見策略：蜜罐路徑（碰一下就封）和錯誤狀態碼累計（短時間刷 401 / 404 才封）。

```typescript
import { Abuse } from '@aomex/abuse';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import { routers, WebApp } from '@aomex/web';

const abuse = new Abuse({ // [!code focus:18]
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
  mount: [abuse.web(), routers('./src/routers')], // [!code highlight]
});
```

本地 / 單測用 memory；生產多副本把 `store` 換成 Redis 介面卡，否則封禁只在本機生效。`window` / `blockFor` 等時長接受毫秒數或可讀字串（如 `'1 hour'`、`'30m'`），與 [快取](/zh-TW/core/cache#時長-durationinput) 同一套 `DurationInput`。

請求進來時：若 IP 已封禁 → 預設 **403**；命中蜜罐且滿額 → 當場封禁並 403。`http-error` 在響應結束後計數，**撞線當次仍返回原狀態碼**，下一請求才因封禁變 403。

WebSocket 側用同一份 `abuse` 掛 `.socket()`（事件蜜罐等），見 [濫用防護（WebSocket）](/zh-TW/websocket/abuse)，本頁不重複。

## 蜜罐路徑

故意放一些「正常使用者不會訪問」的路徑（`/.env`、`/wp-admin/**` 等）。有人掃到了就按 IP 計數，滿額封禁。路徑字串支援精確匹配、簡單 glob；也可以直接寫正則。正則會對 `pathname + search` 檢測，便於抓帶奇怪 query 的探測。`methods` 可選，未配則不限方法。

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

寫法對照：

| 寫法 | 匹配範圍 |
| --- | --- |
| 精確串（無 `*`） | 整段 pathname 完全相等，如 `'/.env'` 不命中 `'/.env.local'` |
| `*` | **單段內**任意字元，**不跨** `/`。`'/wp-*.php'` 命中 `/wp-login.php`，不命中 `/wp/admin.php` |
| `**` | **可跨多段**。`'/a/**/c'` 命中 `/a/b/d/c`，不命中 `/a/c`（中間至少還要有一段） |
| 末尾 `/**` | 目錄自身 + 任意深層子路徑。`'/.git/**'` 命中 `/.git`、`/.git/config`，不誤傷 `/.github` |
| `RegExp` | 測 `pathname + search`，例如 `/^\/admin\?.*dump=/` |

glob 只看 pathname，query 不影響；要連 query 一起判用正則。`paths` 不能為空；建立時就會校驗。花括號等不是擴充套件語法，按字面量匹配。

## 按錯誤狀態碼累計

短時間刷出大量 404 / 401，往往是在掃介面或撞憑證。用 `http-error`：同一策略內多個 `statusCodes` **混合累計**。可再限 `paths` / `methods`；未配則全站該狀態碼都算。

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

適合擋掃介面；登入介面上的 401 若也想嚴管，可單獨再掛一條帶 `paths` 的策略，別和全站 404 混在一個桶裡。

## 業務上報：假 token 試探

響應本身可能是成功（如 logout 無論 token 在不在都 204），但仍想按 IP 記「可疑試探」時，用 `ip-abuse` + 路由裡呼叫。`reason` 用字串即可；須與策略裡宣告的一致，未知 reason 執行時拋錯。同一 reason 只能配一條。

```typescript
const abuse = new Abuse({
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

業務 reason 多了之後，也可以用 TypeScript `enum`（字串或數字成員都行）收攏，避免魔法字串散落。策略與 `ipAbuse` 都傳列舉成員；這時第二參會收成「策略裡出現過的成員」，未配置的成員、以及裸 `'logout-miss'` 都會被型別攔住。

```typescript
enum IpAbuseReason {
  LogoutMiss = 'logout-miss',
  TokenProbe = 'token-probe',
}

// strategies 里：reason: IpAbuseReason.LogoutMiss
await abuse.ipAbuse(ctx.request.ip, IpAbuseReason.LogoutMiss);
```

## 業務上報：賬號維度

賬號級濫用（刷優惠、撞庫後的使用者維度等）用 `user-abuse`。包內**不寫使用者庫**——滿額只調 `onBanUser`，你在回撥裡改庫、踢 session。配置了任一 `user-abuse` 時 **`onBanUser` 必填**，建立階段就會檢查。`reason` 同樣可以是字串，也可以是 enum。

```typescript
const abuse = new Abuse({
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

用 enum 時寫法與 IP 相同：策略寫 `UserAbuseReason.OrderProbe`，上報與 `onBanUser` 的 `reason` 都會收成聯合成員。數字 enum（如 `OrderProbe = 1`）也行；儲存前會 `String(reason)`，分桶鍵是字串形式。

`detail` 含 `count` / `limit`，以及解析成毫秒的 `banFor`（策略未配則為 `undefined`）。同一使用者同一 reason 在視窗內只會成功觸發一次 `onBanUser`（用快取佔位防併發重複）；回撥拋錯會放開佔位，允許視窗內重試。

## 健康檢查繞過與手動封禁

探針路徑不該被封禁邏輯擋住：給 `.web()` 傳 `bypass`。運維要臨時封 / 解封某個 IP，直接調 `blockIP` / `unblockIP`；`isIPBlocked` 用來查詢。想打審計日誌，掛 `onBlockIP`——策略撞線、`ipAbuse` 滿額或手動 `blockIP` 時都會進回撥。

被封時預設拋 **403**；要對齊限速語義改成 429，傳 `blockedError`。

```typescript
const abuse = new Abuse({
  store,
  strategies: [/* ... */],
  onBlockIP: async (ip, reason, detail) => {
    services.logger.warn('abuse.block', { ip, reason, ...detail });
  },
});

mount: [
  abuse.web({ // [!code focus:6]
    bypass: (ctx) => {
      return ctx.request.pathname === '/health';
    },
    blockedError: new HttpError(429, 'blocked', { code: 'ABUSE_BLOCKED' }),
  }),
  routers('./src/routers'),
],

await abuse.blockIP('203.0.113.8', '1 day');
await abuse.unblockIP('203.0.113.8');
```

`onBlockIP` 的 `reason` 在 HTTP 側常見為 `'honeypot' | 'http-error' | 'ip-abuse' | 'manual'`；若同一例項還掛了 WebSocket 事件蜜罐，還會出現 `'socket-events'`（見 [濫用防護（WebSocket）](/zh-TW/websocket/abuse)）。`detail.blockFor` 單位是毫秒；已封則再調 `blockIP` 會跳過（不重新整理 TTL、不重複回撥）。

::: tip
濫用封禁偏「抓到了就關一陣」；全站軟限流仍看 [請求限速](/zh-TW/plugins/rate-limit)。兩者可以同時掛：限速靠前擋毛刺，濫用按策略累計後再封。
:::

## 相關

- [請求限速](/zh-TW/plugins/rate-limit)
- [濫用防護（WebSocket）](/zh-TW/websocket/abuse)
- [快取](/zh-TW/core/cache)（`store` 介面卡與 `DurationInput`）
- [CSRF 防護](/zh-TW/plugins/csrf)
