---
outline: deep
---

# 訪問日誌

想在應用裡看到「誰打了哪個介面、花了多久」——用 `@aomex/access-log` 的 `httpAccessLog()`。請求結束打一行。

**生產環境優先用 Nginx 的 access_log**（或閘道器自帶的）。本包裝這幾種情況：本地開發、前面沒有反代、以及日誌裡要拼 **userId / 租戶 / traceId** 這類只有進了 Node 才能拿到的欄位。

```bash
pnpm add @aomex/access-log
```

## 掛在 routers 之前

把 `httpAccessLog()` 放在 `routers` **之前**。請求走完整條洋蔥後打一行；404、校驗 400 也會記。掛太靠後，耗時和早退路徑會對不齊你想要的「全站審計」。

```typescript
import { httpAccessLog } from '@aomex/access-log';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    httpAccessLog(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

什麼都不配時，預設打到控制台，大致是 combined 風格：ip、method、url、statusCode、duration、contentLength。本地直連掛上即可；排慢介面再加 [響應時間](/zh-TW/plugins/response-time)。

::: warning
掛在 routers **後面** 時，整條鏈耗時和早退 404 可能對不上你想要的「全站審計」。
:::

## 改格式、落到檔案

生產要對齊 ELK / Loki 欄位順序，或寫到檔案裡，用 `format` + `transports`。`format` 建議用 `HttpAccessLogToken` 拼接，別手寫容易拼錯的佔位符。

```typescript
import { HttpAccessLogToken, httpAccessLog } from '@aomex/access-log';
import { FileTransport } from '@aomex/logger';

httpAccessLog({
  format: [
    HttpAccessLogToken.ip,
    HttpAccessLogToken.method,
    HttpAccessLogToken.url,
    HttpAccessLogToken.statusCode,
    HttpAccessLogToken.duration,
    HttpAccessLogToken.contentType,
  ].join(' '),
  transports: [new FileTransport({ file: './logs/access.log' })], // [!code highlight]
});
```

傳空 `transports` 或 `disabled: true` 相當於關掉訪問日誌。生產有 Nginx 時，**優先**閘道器的 `access_log`；只有要自定義 token、或前面沒有反代時，再開應用層落盤 / 推採集，並與業務日誌分流。

## 拼上 userId

日誌在 `await next()` **之後**寫行，所以內層鑑權掛上的 `ctx.auth` 一般能讀到。用 `customTokens` 往 `format` 裡塞業務欄位：回撥拿到的是完整 `WebContext`。

```typescript
httpAccessLog({
  format: `${HttpAccessLogToken.method} ${HttpAccessLogToken.url} [userId] ${HttpAccessLogToken.statusCode}`,
  customTokens: { // [!code highlight]
    userId: (ctx) => {
      return String(ctx.auth?.bearer?.data?.userId ?? '-');
    },
  },
});
```

常與 [響應時間](/zh-TW/plugins/response-time) 搭配：頭裡的 `X-Response-Time` 給客戶端 / 閘道器看，日誌裡的 duration 進採集平臺。

訪問日誌適合看流量和耗時，**不要**當成敏感操作的唯一審計——下單、改許可權這類還是寫業務日誌或審計表。

## 下一步

- 響應頭耗時：[響應時間](/zh-TW/plugins/response-time)
- WebSocket 連線 / 訊息訪問日誌：[訪問日誌（WebSocket）](/zh-TW/websocket/access-log)
- 分級出口 / requestId：[日誌](/zh-TW/core/logger)
