---
outline: deep
---

# 响应压缩

大 JSON、报表类接口在客户端支持 `Accept-Encoding` 时做 gzip / br / zstd 等压缩，减带宽。

**生产优先在 Nginx（或 CDN）做压缩**，Node 进程少烧 CPU、也更好和静态资源、TLS 终结放一起。只有本机直连、没有反代、或网关暂时压不了某种编码时，再在应用里挂 `@aomex/compress`。小响应和已压缩资源（图片、视频）都应跳过，避免白烧 CPU。

```bash
pnpm add @aomex/compress
```

## WebApp 全站挂载

确认边缘**没有**在压同一条响应后，再把 `compress()` 挂进 `WebApp.mount`。响应在 `await next()` **之后**按 `Accept-Encoding` 压缩，业务照常 `ctx.send`，不必在 action 里判断 gzip。

```typescript
import { compress } from '@aomex/compress';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    compress(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

compress() 带 CompressProps：ctx.needCompress 可在单条路由上强制开/关（补全会出现该字段）。响应里会有 Content-Encoding；text/event-stream 等流式类型一般会跳过，避免缓冲整段流。

## 阈值与算法

| 选项 | 什么时候用 | 默认 |
| --- | --- | --- |
| `threshold` | 小于阈值的 body 不压，省 CPU | `1024` |
| `filter` | 全局跳过不可压缩类型；可被 `ctx.needCompress` 覆盖 | 按 MIME 判断 |
| `zstd` / `br` / `gzip` / `deflate` | 只认某一种算法时关掉其余 | 均启用 |
| `ctx.needCompress` | SSE、大文件下载等单路由例外 | 由 `filter` 决定 |

算法优先级（客户端都支持时）：**zstd → br → gzip → deflate**。

### 大列表 / 导出

```typescript
compress({ threshold: '4kb' });
```

### SSE 必须关压缩

```typescript
router.get('/events', {
  action: async (ctx) => {
    ctx.needCompress = false; // [!code highlight]
    ctx.send(sseStream);
  },
});
```

常见 mount 顺序：访问日志 / 响应时间 → compress → 路由（压缩要看到最终 body）。

| 环境 | 建议 |
| --- | --- |
| 本地直连 Node | 可挂 `compress()` 观察体积 |
| 生产有 Nginx / CDN | **优先边缘压缩**；应用层不要再挂，防双重压缩 |
| 边缘暂时压不了 | 再考虑应用内 `compress()`，并关掉网关上的同类模块 |

::: tip
Nginx 常见写法是 `gzip on;`（以及按需的 Brotli 模块）。应用与网关**二选一**即可。
:::

::: warning
网关和应用同时压缩时，体积未必更小，延迟和 CPU 往往双份。
:::

流式接口（如 SSE）忘了 ctx.needCompress = false 时，缓冲会破坏实时性。与 [ETag](/zh/plugins/etag) 叠用时别想当然排顺序，改完后用真实请求验 304 与体积。

## 下一步

- 条件缓存：[ETag](/zh/plugins/etag)
- 静态资源预压缩：[静态文件](/zh/plugins/serve-static)
- 响应头耗时：[响应时间](/zh/plugins/response-time)