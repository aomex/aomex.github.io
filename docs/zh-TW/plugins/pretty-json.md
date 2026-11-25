---
outline: deep
---

# 美化 JSON

開發時在瀏覽器裡看 **帶縮排的 JSON**，省得在一行長字串裡找欄位。生產預設關——否則響應體積明顯變大（移動端尤其虧），公開 API 還不該靠 query 放大 body。

```bash
pnpm add @aomex/pretty-json
```

## 開發環境全站掛載

`prettyJson()` 在 `await next()` **之後**把 JSON 響應改成帶縮排文本，掛進 `WebApp.mount` 即可。本地按環境開啟；生產用 `enable: false`。

```typescript
import { prettyJson } from '@aomex/pretty-json';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:7]
    prettyJson({
      enable: process.env.NODE_ENV !== 'production', // [!code highlight]
      query: 'pretty',
    }),
    routers('./src/routers'),
  ],
});
```

普通 WebMiddleware；ctx 無額外欄位。效果是 Content-Type 仍為 JSON 時 body 變成 `JSON.stringify(..., null, spaces)` 的可讀文本；物件模式可讀流會走流式 stringify。團隊習慣 4 空格時加 `spaces: 4`（預設 `2`）。

## 生產按需：只認 ?pretty

全站美化進不了生產時，關掉 `enable`，只留 query 開關：訪問 `/internal/debug/state?pretty` 才縮排。公開路由別依賴這個放大響應。

```typescript
prettyJson({
  enable: false,
  query: 'pretty', // [!code highlight]
});
```

| 環境 | 建議 |
| --- | --- |
| 本地 | `enable: true`，或只用 `?pretty` |
| 生產 | `enable: false`；別讓公開路由靠 query 放大響應 |

大列表全量 pretty 時體積可能是緊湊 JSON 的數倍，Postman 也會卡。與 [Compress](/zh-TW/plugins/compress) 疊用時能壓一點體積，但根源仍是 pretty 變長了 body。

## 下一步

- JSON 業務形態：[約束響應](/zh-TW/web/response)
- 壓體積：[Compress](/zh-TW/plugins/compress)
- 開發期文件 UI：[Swagger UI](/zh-TW/openapi/swagger-ui)
