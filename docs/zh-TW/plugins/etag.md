---
outline: deep
---

# ETag

給成功的 GET/HEAD 響應算實體標籤：客戶端帶 If-None-Match 且內容未變時回 **304**，省頻寬。適合半靜態配置、版本資訊；高度個性化的列表收益通常不大。

```bash
pnpm add @aomex/etag
```

## WebApp 全站掛載

在 `WebApp.mount` 裡掛上 `etag()`，成功的 GET/HEAD 會自動帶 ETag；客戶端迴帶 If-None-Match 且未變時走 304。業務仍照常 `ctx.send`。

```typescript
import { etag } from '@aomex/etag';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    etag(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

業務仍 ctx.send(data)；匹配且「新鮮」時中介軟體會走 304，body 為空。

普通 WebMiddleware，不寫 ctx 新欄位。效果側：首次響應帶 ETag；再次請求頭帶 If-None-Match 且一致 → **304**。已有 Etag 頭、非 2xx、非 GET/HEAD 時一般不會改寫。

## 弱校驗與疊用

| 選項 | 什麼時候用 | 預設 |
| --- | --- | --- |
| `weak` | 內容語義等價即可 304（動態拼 JSON）；強校驗要位元組一致 | `false`（`ReadStream` 常弱校驗） |

```typescript
mount: [etag({ weak: true })];
```

### 半靜態 API（生產常開）

```typescript
router.get('/api/config', {
  action: async (ctx) => {
    ctx.send(await loadPublicConfig());
  },
});
```

### 靜態 + 壓縮

```typescript
mount: [
  etag(), // [!code highlight]
  compress(),
  serveStatic({ root: './dist' }),
  routers('./src/routers'),
],
```

| 環境 | 建議 |
| --- | --- |
| 生產 | 靜態、半靜態介面建議開；「使用者訂單」類個性化 API 可不對全站強上 |
| 本地 | 除錯 JSON 常被 304 蓋住時，可先不掛或硬重新整理；測條件請求再開 |

```typescript
mount: [
  ...(process.env.NODE_ENV === 'production' ? [etag()] : []),
  routers('./src/routers'),
],
```

大流量也可把快取交給 CDN；應用內 ETag 適合你還想自己控 304 語義時。

本地開著 ETag 卻覺得「改程式碼瀏覽器不變」時，先懷疑 **304**，再查業務。每條響應都個性化還全站強開 ETag，算摘要白耗 CPU。與 [Compress](/zh-TW/plugins/compress) 疊用時按部署驗一遍中介軟體與閘道器順序，以真實 304/體積行為為準。

## 下一步

- 壓縮：[Compress](/zh-TW/plugins/compress)
- 靜態目錄：[靜態檔案](/zh-TW/plugins/serve-static)
- 約束響應形態：[約束響應](/zh-TW/web/response)