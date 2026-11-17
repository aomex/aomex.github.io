# 服務層

把「查庫、調第三方、讀寫快取」從路由 action 裡挪出去，收成可複用的 **Service**；用 **combineServices** 拼成一個帶型別的 services 袋，在 Web、Console、Cron 裡同一套名字呼叫。

業務類繼承 Service，對外只暴露普通 async 方法；連庫、預熱放在 onInit，釋放放在 onDestroy（保持 protected，別給外面直接調）。

```typescript
import { Service } from '@aomex/common';

export default class UserService extends Service {
  private cache = new Map<number, { name: string }>();

  protected override async onInit(): Promise<void> { // [!code highlight]
    // 预热连接、读配置…
  }

  protected override async onDestroy(): Promise<void> {
    this.cache.clear();
  }

  async findById(id: number) {
    return this.cache.get(id) ?? null;
  }
}
```

用工廠 + combineServices 註冊；**基礎設施建議寫進 eager**，應用一啟動就先連上，別等第一條線上請求才初始化：

```typescript
import { combineServices } from '@aomex/common';

export const services = await combineServices( // [!code highlight]
  {
    user: () => import('./user.service.js'),
    cache: () => import('./cache.service.js'),
    logger: () => import('./logger.service.js'),
  },
  { eager: ['cache', 'logger'] },
);
```

接到 Web 後，services 的型別直接來自 combineServices 的鍵名和各個 Service 的**公開方法**：await services.user.findById(1) 有完整引數、返回值補全；onInit、onDestroy、private 欄位**不會**出現在 services.user 上。同步寫的 Service 方法，從外面調時型別上仍按 **Promise** 走，統一寫 await 即可。

```typescript
import { WebApp } from '@aomex/web';

const app = new WebApp({
  services, // [!code highlight]
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

::: tip
別在業務裡自己 new UserService() 卻不交給 WebApp / ConsoleApp 的 services——關停時框架管不到，連線可能漏關。
:::

路由或中介軟體裡：

```typescript
const user = await services.user.findById(1);
await services.logger.info('用户已查询', { userId: user?.name });
```

在別的檔案 import { services } from './services/index.js'，不必再給模組做額外增強。

## 懶載入與測試注入

正式程式碼裡用 `() => import('./xxx.service.js')` 推遲載入，冷啟動更快：

```typescript
user: () => import('./user.service.js'),
```

測試裡注入假實現可以寫成非同步工廠直接返回類：

```typescript
user: async () => FakeUserService,
```

::: warning
業務程式碼不要寫成 `async () => UserService`。類已經跟著當前模組進記憶體了，懶載入形同虛設，還無端佔執行時記憶體。正式環境一律 `() => import('./user.service.js')`；上面這種寫法只留給測試注入。
:::

每個檔案 `export default class XxxService` 最省心，loader 不用猜多個匯出。

## eager

預設服務是**懶載入**的：第一次 `await services.xxx` 才例項化、跑 `onInit`。`eager` 裡列出的名字會在 `combineServices` 返回前就建好——適合 Redis、日誌這類「程序一起來就要就緒」的基礎設施。

```typescript
{ eager: ['cache', 'logger'] },
```

本地試跑、極簡 CLI 可以不寫 eager。若在 A 的 `onInit` 裡要 `await services.cache.xxx`，而 cache 沒進 eager，連庫會拖到第一次業務呼叫，啟動階段容易踩時序坑。

## 生命週期鉤子

有些資源**不必**做成 Service、也不進 `services` 袋（例如模組級 PrismaClient、外掛內部的 Redis store），但仍要在程序啟動時連上、關停時斷開。這時用 `registerLifecycle`：登記時立刻跑 `onInit`，`WebApp` / `ConsoleApp` 關停時再跑 `onDestroy`。

```typescript
import { registerLifecycle } from '@aomex/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

await registerLifecycle({ // [!code focus:4]
  onInit: () => prisma.$connect(),
  onDestroy: () => prisma.$disconnect(),
});
```

返回的函式用來**提前取消登記**（已關停或已取消後再調無效果）。`onInit` 失敗則不會進入銷燬佇列。限流等外掛內部也會用同一套鉤子管 store，業務側一般不用再為它們登記一遍。

已經放進 `combineServices` 的類繼續用 `onInit` / `onDestroy` 即可，不必再套一層 `registerLifecycle`。

## 多袋合併

大倉按域拆多個 combineServices 再合併交給 App：

```typescript
const app = new WebApp({
  services: [domainA, domainB], // [!code highlight]
  logger: domainA.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

類名以 Service 結尾時，[`createRemember`](/zh-TW/core/cache#快取裝飾器) 等會用去掉字尾後的名字區分快取鍵（UserService → User）。

服務之間互相呼叫：在類裡 import { services } from './index.js'，再 await services.other.method() 即可。類內 this.foo() 照常寫；只有**跨類**才用 await services.other.foo()。

## 下一步

- 會話、`createRemember`：[快取](/zh-TW/core/cache)
- 全站日誌出口：[日誌](/zh-TW/core/logger)
- 路由怎麼寫薄：[介面路由](/zh-TW/web/router)