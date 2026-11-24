---
outline: deep
---

# 響應時間

在每個響應頭裡寫入服務端處理耗時（如 X-Response-Time），方便瀏覽器、閘道器、整合測試觀測慢介面。無配置項，掛上即用。

```bash
pnpm add @aomex/response-time
```

## 與訪問日誌同排

`responseTime()` 無配置，掛在訪問日誌旁：請求結束後在響應頭寫入耗時。和 Nginx `access_log` / [httpAccessLog](/zh-TW/plugins/access-log) 的 duration 互補（頭給客戶端/閘道器，日誌給平臺聚合）。生產訪問日誌仍優先邊緣；本外掛只解決「響應頭裡要不要帶耗時」。

```typescript
import { responseTime } from '@aomex/response-time';
import { httpAccessLog } from '@aomex/access-log';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:5]
    responseTime(), // [!code highlight]
    httpAccessLog(),
    routers('./src/routers'),
  ],
});
```

使用 process.hrtime，頭裡常見形如 12.345ms。失敗響應也會帶上；錯誤路徑可能合併進 HttpError.headers。

普通 WebMiddleware，不改 ctx 業務型別。你在 Network 面板看響應頭即可，不必在 action 裡手寫。

## 響應頭 vs 訪問日誌

| 輸出 | 給誰看 | 經驗 |
| --- | --- | --- |
| `X-Response-Time` | 瀏覽器、API 閘道器、測試斷言 | 與路由改動無關，全站同一行為 |
| 訪問日誌 `duration` | 日誌平臺、告警、按路由聚合 | 見 [HTTP 訪問日誌](/zh-TW/plugins/access-log) |

沒有選項表：**要頭裡耗時就開，不要就不掛。** 一般放在 routers 前、靠近訪問日誌。

| 環境 | 建議 |
| --- | --- |
| 生產 | 常與 `httpAccessLog()` 一起開 |
| 本地 | 只 tail 控制台時可只留訪問日誌 |

X-Response-Time 不是端到端總耗時：前面還有閘道器、TLS、客戶端排隊。對外 API 若擔心資訊洩露，可在邊緣剝掉頭；內網/自有前端一般無所謂。只開 responseTime 不落盤時，排障高峰仍要日誌聚合裡的 duration（見 [HTTP 訪問日誌](/zh-TW/plugins/access-log)）。

## 下一步

- 訪問日誌：[HTTP 訪問日誌](/zh-TW/plugins/access-log)
- 分散式追蹤：[鏈路追蹤](/zh-TW/plugins/async-trace)
- [中介軟體](/zh-TW/core/middleware)