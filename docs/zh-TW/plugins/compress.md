---
outline: deep
---

# 響應壓縮

大 JSON、報表類介面在客戶端支援 `Accept-Encoding` 時做 gzip / br / zstd 等壓縮，減頻寬。

**生產優先在 Nginx（或 CDN）做壓縮**，Node 程序少燒 CPU、也更好和靜態資源、TLS 終結放一起。只有本機直連、沒有反代、或閘道器暫時壓不了某種編碼時，再在應用裡掛 `@aomex/compress`。小響應和已壓縮資源（圖片、影片）都應跳過，避免白燒 CPU。

```bash
pnpm add @aomex/compress
```

## WebApp 全站掛載

確認邊緣**沒有**在壓同一條響應後，再把 `compress()` 掛進 `WebApp.mount`。響應在 `await next()` **之後**按 `Accept-Encoding` 壓縮，業務照常 `ctx.send`，不必在 action 裡判斷 gzip。

```typescript
import { compress } from '@aomex/compress';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    compress(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

compress() 帶 CompressProps：ctx.needCompress 可在單條路由上強制開/關（補全會出現該欄位）。響應裡會有 Content-Encoding；text/event-stream 等流式型別一般會跳過，避免緩衝整段流。

常見 mount 順序：訪問日誌 / 響應時間 → compress → 路由（壓縮要看到最終 body）。演算法優先順序（客戶端都支援時）：**zstd → br → gzip → deflate**。

## 大列表抬閾值

預設小於約 `1024` 位元組的 body 不壓，省 CPU。匯出、大列表可把 `threshold` 調到 `'4kb'` 一類；數字或不帶單位時單位是 byte。

```typescript
compress({ threshold: '4kb' }); // [!code highlight]
```

只認某一種演算法時，把其餘設成 `false`（如 `br: false`）。`filter` 按 Content-Type 判斷要不要壓，可被單路由的 `ctx.needCompress` 覆蓋。

## SSE 必須關壓縮

流式介面忘了關壓縮時，緩衝會破壞即時性。在 action 裡把 `ctx.needCompress` 設成 `false`：

```typescript
router.get('/events', {
  action: async (ctx) => {
    ctx.needCompress = false; // [!code highlight]
    ctx.send(sseStream);
  },
});
```

| 環境 | 建議 |
| --- | --- |
| 本地直連 Node | 可掛 `compress()` 觀察體積 |
| 生產有 Nginx / CDN | **優先邊緣壓縮**；應用層不要再掛，防雙重壓縮 |
| 邊緣暫時壓不了 | 再考慮應用內 `compress()`，並關掉閘道器上的同類模組 |

::: tip
Nginx 常見寫法是 `gzip on;`（以及按需的 Brotli 模組）。應用與閘道器**二選一**即可。
:::

::: warning
閘道器和應用同時壓縮時，體積未必更小，延遲和 CPU 往往雙份。
:::

與 [ETag](/zh-TW/plugins/etag) 疊用時別想當然排順序，改完後用真實請求驗 304 與體積。

## 下一步

- 條件快取：[ETag](/zh-TW/plugins/etag)
- 靜態資源預壓縮：[靜態檔案](/zh-TW/plugins/serve-static)
- 響應頭耗時：[響應時間](/zh-TW/plugins/response-time)
