---
outline: deep
---

# 静态资源

把磁盘上的目录（前端 dist、public、下载包）映射成 HTTP 文件响应；未命中时 next() 交给后续 API。只服务你指定的 root，别指到项目根或 node_modules。

```bash
pnpm add @aomex/serve-static
```

## 放在路由之前

静态中间件通常放在业务路由**之前**（先尝试文件，再进 API）。`root` 必填，指向前端产物或下载目录。

```typescript
import { serveStatic } from '@aomex/serve-static';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    serveStatic({ root: './public' }), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

普通 WebMiddleware。命中文件时直接送出内容；不命中则放行。路径穿越、..、NUL、点文件等会直接拒绝（安全校验在包内）。访问目录时默认回落 `index.html`（可用 `indexFile` 改）。构建已产出旁路 `.br` / `.gz` 时，`useCompressedFile` 默认会优先用（可关）。

::: warning
root: '.' 或指到含 node_modules 的目录有路径泄露风险，线上见过误配。
:::

## 带 hash 的 chunk：长缓存

带 content hash 的 JS/CSS chunk 可以设长 `cacheControl`；`index.html` 等入口不宜同样 `immutable`，否则发版后用户一直旧壳。

```typescript
serveStatic({
  root: './dist',
  cacheControl: { // [!code highlight]
    maxAge: 86_400_000,
    immutable: true,
  },
});
```

默认 `maxAge: 0`。HTML 宜短缓存或 `noCache`。

## URL 前缀与磁盘不一致

CDN / 网关把 `/assets/...` 指到 `./dist` 时，用 `formatPath` 去掉前缀再找文件：

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

深链刷新不能只靠静态中间件：未命中路径要在 routers 后再回落 `index.html`。`send` 与 `serveStatic` 同包导出。

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

| 环境 | 建议 |
| --- | --- |
| 生产 | 大流量常把静态交给 CDN/Nginx；Node 仍适合做兜底或内网 |
| 本地 | 直接 `serveStatic` 指向 Vite 构建产物即可 |

## 下一步

- 条件缓存：[ETag](/zh/plugins/etag)
- 传输压缩：[Compress](/zh/plugins/compress)
- Web 入口组装：[应用入口](/zh/web/)
