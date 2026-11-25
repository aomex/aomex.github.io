---
outline: deep
---

# 靜態資源

把磁碟上的目錄（前端 dist、public、下載包）對映成 HTTP 檔案響應；未命中時 next() 交給後續 API。只服務你指定的 root，別指到專案根或 node_modules。

```bash
pnpm add @aomex/serve-static
```

## 放在路由之前

靜態中介軟體通常放在業務路由**之前**（先嚐試檔案，再進 API）。`root` 必填，指向前端產物或下載目錄。

```typescript
import { serveStatic } from '@aomex/serve-static';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    serveStatic({ root: './public' }), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

普通 WebMiddleware。命中檔案時直接送出內容；不命中則放行。路徑穿越、..、NUL、點檔案等會直接拒絕（安全校驗在包內）。訪問目錄時預設回落 `index.html`（可用 `indexFile` 改）。構建已產出旁路 `.br` / `.gz` 時，`useCompressedFile` 預設會優先用（可關）。

::: warning
root: '.' 或指到含 node_modules 的目錄有路徑洩露風險，線上見過誤配。
:::

## 帶 hash 的 chunk：長快取

帶 content hash 的 JS/CSS chunk 可以設長 `cacheControl`；`index.html` 等入口不宜同樣 `immutable`，否則發版後用戶一直舊殼。

```typescript
serveStatic({
  root: './dist',
  cacheControl: { // [!code highlight]
    maxAge: 86_400_000,
    immutable: true,
  },
});
```

預設 `maxAge: 0`。HTML 宜短快取或 `noCache`。

## URL 字首與磁碟不一致

CDN / 閘道器把 `/assets/...` 指到 `./dist` 時，用 `formatPath` 去掉字首再找檔案：

```typescript
serveStatic({
  root: './dist',
  formatPath: (pathname) => { // [!code highlight]
    const trimmed = pathname.replace(/^\/assets/, '');
    return trimmed || '/';
  },
});
```

## API + SPA 兜底

深鏈重新整理不能只靠靜態中介軟體：未命中路徑要在 routers 後再回落 `index.html`。`send` 與 `serveStatic` 同包匯出。

```typescript
import { middleware } from '@aomex/common';
import { send, serveStatic } from '@aomex/serve-static';

mount: [
  serveStatic({ root: './dist' }),
  routers('./src/routers'),
  middleware.web(async (ctx) => {
    const ok = await send(ctx, {
      root: './dist',
      formatPath: () => { // [!code highlight]
        return '/index.html';
      },
    });
    if (!ok) {
      ctx.throw(404);
    }
  }),
];
```

| 環境 | 建議 |
| --- | --- |
| 生產 | 大流量常把靜態交給 CDN/Nginx；Node 仍適合做兜底或內網 |
| 本地 | 直接 `serveStatic` 指向 Vite 構建產物即可 |

## 下一步

- 條件快取：[ETag](/zh-TW/plugins/etag)
- 傳輸壓縮：[Compress](/zh-TW/plugins/compress)
- Web 入口組裝：[應用入口](/zh-TW/web/)
