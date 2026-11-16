---
outline: deep
---

# 自定義中介軟體

[中介軟體](/zh-TW/core/middleware) 裡的 `middleware.mixin`、`.skip()`（支援函式或 `boolean`）、`dependsOn`（只借上游型別）夠日常組合。到本頁通常是因為：**執行時要做事，生成 OpenAPI / CLI 幫助時還要往契約裡寫一筆**——兩件事寫在同一個中介軟體裡，改一處兩邊一起變。

下面按「先 Web 文件鉤子 → 再 Console 幫助 → 最後跨舞臺複用」往下做。跟著敲完，你會得到一個掛上就能影響 Swagger 的 trace 中介軟體。

## 先分清：mixin 還是 web / console

| 你要的效果 | 用哪個 |
| --- | --- |
| 只改執行時 `ctx`，文件不用管 | `middleware.mixin`（見 [中介軟體](/zh-TW/core/middleware)） |
| Web：執行時 + 改 OpenAPI operation | `middleware.web({ fn, openapi })` |
| Console：執行時 + 貢獻 `--help` 樹 | `middleware.console({ fn, help })` |

`middleware.web` 的例項**不能**直接掛到 Console；反過來也不行。兩邊都要時，把公共邏輯抽成普通函式，再各包一層。

## 第一步：先寫出能跑的執行時

目標：每條請求帶上 `traceId`，下游 action 能讀到。

```typescript
// src/middlewares/trace-id.ts
import { middleware } from '@aomex/common';

export const traceId = middleware.web<{ // [!code highlight]
  readonly traceId: string;
}>({
  fn: async (ctx, next) => {
    ctx.traceId = crypto.randomUUID();
    await next();
  },
});
```

泛型 `{ readonly traceId: string }` 寫在 `middleware.web` 上之後，**更後面的中介軟體和同路由 action** 裡才會補全 `ctx.traceId`。只賦值、不寫泛型，執行時有欄位，TypeScript 仍當它不存在。

掛到應用或路由上試一下：

```typescript
import { routers, WebApp } from '@aomex/web';
import { traceId } from './middlewares/trace-id.js';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [
    traceId, // [!code highlight]
    routers('./src/routers'),
  ],
});
```

```typescript
action: async (ctx) => {
  await services.logger.info('ok', { traceId: ctx.traceId });
  ctx.send({ ok: true });
};
```

這時 Swagger 裡還不會出現 trace 相關說明——執行時和文件是分開注入的。

## 第二步：補上 OpenAPI 鉤子

在同一個 `middleware.web` 引數物件里加 `openapi`。生成文件掃路由時，框架會調這些鉤子，讓你改當前 operation（或整份 document）。

常見入口（按型別提示選，不必全寫）：

| 鉤子 | 什麼時候用 |
| --- | --- |
| `onMethod` | 給**當前這條** operation 加引數、響應、security |
| `postMethod` | 別人先寫完再收尾（例如統一信封） |
| `onDocument` | 註冊 `components.securitySchemes` 這類全域性塊 |

給每條掛了 `traceId` 的介面補一個響應頭說明：

```typescript
import { middleware } from '@aomex/common';

export const traceId = middleware.web<{
  readonly traceId: string;
}>({
  fn: async (ctx, next) => {
    ctx.traceId = crypto.randomUUID();
    ctx.response.setHeader('X-Trace-Id', ctx.traceId);
    await next();
  },
  openapi: { // [!code focus:14]
    onMethod(methodItem) {
      methodItem.responses ||= {};
      const ok = methodItem.responses['200'];
      if (ok && typeof ok === 'object' && 'description' in ok) {
        ok.headers ||= {};
        ok.headers['X-Trace-Id'] = {
          schema: { type: 'string', format: 'uuid' },
          description: '请求追踪 ID',
        };
      }
    },
  },
});
```

重新跑 [OpenAPI 生成](/zh-TW/plugins/openapi) 或開啟 Swagger：掛了該中介軟體的 operation 上應能看到 `X-Trace-Id`。鉤子裡改錯結構不會在 `pnpm start` 時報錯，要在生成結果裡核對。

::: tip
中介軟體若**執行時什麼都不做**、只為改文件，先問自己能不能寫在路由 `docs` 或生成器配置裡——空跑一層會讓 mount 更難讀。
:::

## 第三步：Console 側同樣套路

指令要往 `--help` 裡塞一段說明時，用 `middleware.console` + `help`：

```typescript
import { middleware } from '@aomex/common';

export const withDryRunFlag = middleware.console({ // [!code highlight]
  fn: async (ctx, next) => {
    await next();
  },
  help: {
    onDocument(doc) {
      // 按类型提示往帮助树贡献说明；具体字段以编辑器补全为准
    },
  },
});
```

掛在 `commander.create` 的 `mount` 上，和 Web 的 `openapi` 對稱：一邊是 HTTP 契約，一邊是 CLI 幫助。

## 第四步：兩邊共用同一段邏輯

不要複製兩份 UUID 邏輯。抽函式，再包：

```typescript
import { middleware } from '@aomex/common';

const assignTraceId = (ctx: { traceId: string }) => {
  ctx.traceId = crypto.randomUUID();
};

export const webTraceId = middleware.web<{ readonly traceId: string }>({
  fn: async (ctx, next) => {
    assignTraceId(ctx);
    await next();
  },
  openapi: {
    /* 同上 */
  },
});

export const consoleTraceId = middleware.console<{ readonly traceId: string }>({
  fn: async (ctx, next) => {
    assignTraceId(ctx);
    await next();
  },
});
```

## 配錯時你會看到什麼

| 現象 | 多半是 |
| --- | --- |
| action 裡沒有 `ctx.traceId` 補全 | `middleware.web` / `mixin` 漏了 Props 泛型 |
| 執行有 header，Swagger 沒有 | 寫了 `fn` 忘了 `openapi`，或生成時沒掃到掛載該中介軟體的路由 |
| Console 掛了 `middleware.web` 型別報錯 | 舞臺不對，應換 `middleware.console` |
| 健康檢查仍被鑑權擋 | 用 `.skip()`，見 [中介軟體 · skip](/zh-TW/core/middleware#用-skip-繞過某類請求) |

## 相關

- 順序、`.skip()`、`dependsOn`、ctx 合併：[中介軟體](/zh-TW/core/middleware)
- 現成外掛：[訪問日誌](/zh-TW/plugins/http-access-log)、[統一入口 Auth](/zh-TW/plugins/auth)
- 生成文件：[OpenAPI 生成](/zh-TW/plugins/openapi)
