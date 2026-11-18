---
outline: deep
---

# 美化 JSON

開發時在瀏覽器裡看 **帶縮排的 JSON**，省得在一行長字串裡找欄位。生產預設關——否則響應體積明顯變大（移動端尤其虧），公開 API 還不該靠 query 放大 body。

```bash
pnpm add @aomex/pretty-json
```

## 開發環境全站掛載

`prettyJson()` 在 `await next()` **之後**把 JSON 響應改成帶縮排文本，掛進 `WebApp.mount` 即可；生產用 `enable: false` 或只靠 `?pretty` 按需開啟。

```typescript
import { prettyJson } from '@aomex/pretty-json';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
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

普通 WebMiddleware；ctx 無額外欄位。效果是 Content-Type 仍為 JSON 時 body 變成 JSON.stringify(..., null, spaces) 的可讀文本；物件模式可讀流會走流式 stringify。

## enable 與 query 開關

| 選項 | 什麼時候用 | 預設 |
| --- | --- | --- |
| `enable` | 生產務必 `false`；內網除錯工具可單獨開 | `true` |
| `query` | 不全站美化，僅 `?pretty` 時生效 | — |
| `spaces` | 團隊習慣 2 或 4 空格 | `2` |

```typescript
prettyJson({ spaces: 4 });
```

### 僅內網 / 按需

```typescript
prettyJson({
  enable: false,
  query: 'pretty', // [!code highlight]
});
// GET /internal/debug/state?pretty
```

| 環境 | 建議 |
| --- | --- |
| 本地 | `enable: true` 或只用 `?pretty` |
| 生產 | `enable: false`；別讓公開路由靠 query 放大響應 |

大列表全量 pretty 時體積可能是緊湊 JSON 的數倍，Postman 也會卡。與 [Compress](/zh-TW/plugins/compress) 疊用時能壓一點體積，但根源仍是 pretty 變長了 body。

## 下一步

- JSON 業務形態：[約束響應](/zh-TW/web/response)
- 壓體積：[Compress](/zh-TW/plugins/compress)
- 開發期文件 UI：[Swagger UI](/zh-TW/openapi/swagger-ui)