---
outline: deep
---

# HTTP 訪問日誌

在請求結束時打一行訪問日誌：方法、URL、狀態碼、耗時等，用來看流量和慢介面。

**生產優先用 Nginx access_log**（或閘道器 / 負載均衡自帶的訪問日誌）：格式統一、不佔 Node 事件迴圈，也更容易進現有采集。`@aomex/http-access-log` 適合本地開發、沒有反代，或要在日誌裡拼 **userId / 租戶 / traceId** 這類只有進了應用才能拿到的欄位。

```bash
pnpm add @aomex/http-access-log
```

## 靠前掛全站

需要應用內訪問日誌時，把 `httpAccessLog()` 儘量放在 `routers` **之前**：請求結束打一行 combined 風格記錄；404、校驗 400 也會記賬。掛在後面容易對不齊整鏈耗時。

```typescript
import { httpAccessLog } from '@aomex/http-access-log';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    httpAccessLog(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

無配置時類似 combined 的一行文本，預設走 logger 出口（本地多為控制台）。欄位大致含：ip、method、url、statusCode、duration、contentLength。

::: warning
掛在 routers **後面** 時，整條鏈耗時和早退 404 可能對不上你想要的「全站審計」。
:::

customTokens 裡回撥引數是 WebContext：ctx.auth 等欄位要在**內層鑑權跑完後**才能讀到——訪問日誌在 await next() 之後寫行，一般能拿到洋蔥內層掛上的屬性。若 customTokens 讀 ctx.auth 卻總是 -，確認洋蔥順序：鑑權在路由裡、日誌包在外層之前結束時，要把鑑權提高到 Router mount。

## 格式與落盤

| 能力 | 什麼時候用 | 預設 |
| --- | --- | --- |
| `format` | 生產對齊 ELK/Loki 欄位順序 | 內建 combined 風格 |
| `transports` | 落盤、推到遠端採集 | 控制台（跟 `logger`） |
| `customTokens` | 使用者 ID、租戶、traceId | — |
| `HttpAccessLogToken.*` | 拼 `ip` / `method` / `duration` 等 | 包內匯出 |

### 生產：落盤

```typescript
import { HttpAccessLogToken, httpAccessLog } from '@aomex/http-access-log';
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

### 鑑權後寫 userId

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

常與 [響應時間](/zh-TW/plugins/response-time) 搭配：頭裡 X-Response-Time 給客戶端/閘道器，日誌裡 duration 進平臺。

| 環境 | 建議 |
| --- | --- |
| 本地直連 | 掛本外掛打到控制台即可；慢介面排查可再加 `responseTime()` |
| 生產有 Nginx | **優先** `access_log`；應用層只在要自定義 token（使用者、租戶）時再開 |
| 生產無反代 | 本外掛落盤或推到採集，並與業務日誌分流 |

訪問日誌適合流量與耗時觀測，**不要**當敏感操作的唯一審計來源——關鍵業務還要業務日誌或審計表。Nginx 的 access_log 和應用內日誌可以並存，但欄位別做成兩套互相打架的口徑。

## 下一步

- 響應頭耗時：[響應時間](/zh-TW/plugins/response-time)
- 分級出口 / requestId：[日誌](/zh-TW/core/logger)