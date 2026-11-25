---
outline: deep
---

# 非同步鏈路追蹤

訪問日誌只會告訴你「這一條請求 800ms」。要找出**哪幾個 await 吃了時間**，在本請求裡收成一棵樹——適合慢介面排查、Service 裡一串 IO 剖分。日常 CRUD 不必預設依賴；要上標準全鏈路追蹤可看 OpenTelemetry，本包更輕、偏應用內排障。

```bash
pnpm add @aomex/async-trace
```

## 全請求包一層

把 `traceMiddleware` 掛進 `WebApp.mount`（或某一組 Router）：每個請求開一棵根節點；第二引數是請求結束後的回撥，適合「只打慢請求」再對接日誌。

```typescript
import { asyncTrace, traceMiddleware } from '@aomex/async-trace';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:8]
    traceMiddleware('request', (record) => {
      if (record.duration > 500) {
        void asyncTrace.toStack([record]);
      }
    }),
    routers('./src/routers'),
  ],
});
```

掛了之後，Web 上下文會合並 **AsyncTraceMiddlewareProps**：請求裡可用 `ctx.asyncTrace.record`（具體欄位按型別提示來）。沒掛卻指望 `ctx.asyncTrace` 時，型別和執行時都不會有根記錄；要麼掛中介軟體，要麼只用區域性 `traceBlock`。

`traceMiddleware` 是 **mixin** 中介軟體，不是 `middleware.web` 專屬工廠，但可以直接放進 Web mount；Console / command mount 同樣能掛。某一組 API 慢、不想全站開銷時，掛到那個 Router 的 mount 即可。

::: warning
生產環境全量打棧、無閾值有執行時開銷；在 callback 裡按 duration 或採樣對接日誌系統。
:::

## Service 裡剖分熱點

全請求只能看到總耗時；要拆「哪一次查庫慢」，在 Service 裡用 `traceBlock` 包住一段 await。巢狀後 `toStack` 打出來是縮排結構。

```typescript
import { traceBlock } from '@aomex/async-trace';

async loadUser(id: number) {
  return traceBlock('loadUser', async () => { // [!code focus:5]
    const profile = await db.profile.find(id);
    const prefs = await db.prefs.find(id);
    return { profile, prefs };
  });
}
```

類方法裡多個 await 時，裝飾器比手寫 `traceBlock` 乾淨；未傳 label 時預設類似 `ClassName.methodName`，看棧時好認：

```typescript
import { traceMethod } from '@aomex/async-trace';

class UserService {
  @traceMethod() // [!code highlight]
  async load() {
    return [];
  }
}
```

`asyncTrace.run(label, callback)` 在已開啟的樹裡再開子節點。記錄裡一般有 label、duration、parent / children、error 等——排障時盯 duration 和 label 就夠的情況很多。

與 [@aomex/access-log](/zh-TW/plugins/access-log) 互補：訪問日誌記總耗時，鏈路追蹤拆子步驟。本包不替代 OpenTelemetry 等分散式 trace，跨服務還得用標準方案。

## 相關

- 中介軟體順序：[Web 應用](/zh-TW/web/)、[自定義中介軟體](/zh-TW/advanced/middleware)
- 日誌帶上 requestId：[日誌 · withBindings](/zh-TW/core/logger#請求級上下文withbindings)
