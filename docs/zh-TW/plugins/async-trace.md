---
outline: deep
---

# 非同步鏈路追蹤

訪問日誌只會告訴你「這一條請求 800ms」。要找出**哪幾個 await 吃了時間**，在本請求裡收成一棵樹——適合慢介面排查、Service 裡一串 IO 剖分。日常 CRUD 不必預設依賴；要上標準全鏈路追蹤可看 OpenTelemetry，本包更輕、偏應用內排障。

## 全請求 traceMiddleware

安裝（需要時再裝）：

```bash
pnpm add @aomex/async-trace
```

全請求包一層中介軟體：

```typescript
import { asyncTrace, traceMiddleware } from '@aomex/async-trace';

mount: [
  traceMiddleware('request', (record) => { // [!code highlight]
    if (record.duration > 500) {
      void asyncTrace.toStack([record]);
    }
  }),
  routers('./src/routers'),
],
```

沒掛 traceMiddleware 卻指望 ctx.asyncTrace 時，型別和執行時都不會有根記錄；要麼掛中介軟體，要麼只用區域性 traceBlock。

Service 裡區域性剖分：

```typescript
import { traceBlock } from '@aomex/async-trace';

const data = await traceBlock('loadUser', async () => { // [!code highlight]
  const profile = await db.profile.find();
  const prefs = await db.prefs.find();
  return { profile, prefs };
});
```

方法級用裝飾器（類方法裡多個 await 時比手寫 traceBlock 乾淨）：

```typescript
import { traceMethod } from '@aomex/async-trace';

class UserService {
  @traceMethod() // [!code highlight]
  async load() {
    return [];
  }
}
```

未傳 label 時預設類似 ClassName.methodName，看棧時好認。

掛了 traceMiddleware 後，Web 上下文會合並 **AsyncTraceMiddlewareProps**：請求裡可用 **ctx.asyncTrace.record**（具體欄位按型別提示來）。traceMiddleware 是 **mixin** 中介軟體，不是 `middleware.web` 專屬工廠，但可以直接放進 Web mount；Console / command mount 同樣能掛。`asyncTrace.run(label, callback)` 在已開啟的樹裡再開子節點；巢狀後 toStack 打出來是縮排結構。記錄裡一般有 label、duration、parent / children、error 等——排障時盯 duration 和 label 就夠的情況很多。

## 掛載層級與回撥

| 場景 | 用法 |
| --- | --- |
| 整站 HTTP | `WebApp.mount: [traceMiddleware('http')]` |
| 某一組 API | `Router.mount: [traceMiddleware('api-v1')]` |
| 控制台任務 | `ConsoleApp` / command 的 `mount` 同樣可掛 |
| 熱點方法 | `@traceMethod()` 或 `traceBlock` |
| 慢請求落日誌 | `traceMiddleware` 第二引數 `callback`，別在生產熱路徑無腦 `console.log` 全量棧 |

::: warning
生產環境全量打棧、無閾值有執行時開銷；在 callback 裡按 duration 或採樣對接日誌系統。
:::

與 [@aomex/http-access-log](/zh-TW/plugins/http-access-log) 互補：訪問日誌記總耗時，鏈路追蹤拆子步驟。本包不替代 OpenTelemetry 等分散式 trace，跨服務還得用標準方案。

## 相關

- 中介軟體順序：[Web 應用](/zh-TW/web/)、[自定義中介軟體](/zh-TW/advanced/middleware)
- 日誌帶上 requestId：[日誌 · withBindings](/zh-TW/core/logger#請求級上下文withbindings)