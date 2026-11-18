---
outline: deep
---

# ETag

给成功的 GET/HEAD 响应算实体标签：客户端带 If-None-Match 且内容未变时回 **304**，省带宽。适合半静态配置、版本信息；高度个性化的列表收益通常不大。

```bash
pnpm add @aomex/etag
```

## WebApp 全站挂载

在 `WebApp.mount` 里挂上 `etag()`，成功的 GET/HEAD 会自动带 ETag；客户端回带 If-None-Match 且未变时走 304。业务仍照常 `ctx.send`。

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

业务仍 ctx.send(data)；匹配且「新鲜」时中间件会走 304，body 为空。

普通 WebMiddleware，不写 ctx 新字段。效果侧：首次响应带 ETag；再次请求头带 If-None-Match 且一致 → **304**。已有 Etag 头、非 2xx、非 GET/HEAD 时一般不会改写。

::: tip
全站开了 [响应体套壳](/zh/web/envelope) 时，套壳会改写 body 并把外层改成 200；框架会**去掉原 ETag**，避免摘要还对应套壳前的内容。需要条件缓存的接口，确认摘要落在套壳之后，或对该出口 `skipEnvelope`。
:::

## 弱校验与叠用

| 选项 | 什么时候用 | 默认 |
| --- | --- | --- |
| `weak` | 内容语义等价即可 304（动态拼 JSON）；强校验要字节一致 | `false`（`ReadStream` 常弱校验） |

```typescript
mount: [etag({ weak: true })];
```

### 半静态 API（生产常开）

```typescript
router.get('/api/config', {
  action: async (ctx) => {
    ctx.send(await loadPublicConfig());
  },
});
```

### 静态 + 压缩

```typescript
mount: [
  etag(), // [!code highlight]
  compress(),
  serveStatic({ root: './dist' }),
  routers('./src/routers'),
],
```

| 环境 | 建议 |
| --- | --- |
| 生产 | 静态、半静态接口建议开；「用户订单」类个性化 API 可不对全站强上 |
| 本地 | 调试 JSON 常被 304 盖住时，可先不挂或硬刷新；测条件请求再开 |

```typescript
mount: [
  ...(process.env.NODE_ENV === 'production' ? [etag()] : []),
  routers('./src/routers'),
],
```

大流量也可把缓存交给 CDN；应用内 ETag 适合你还想自己控 304 语义时。

本地开着 ETag 却觉得「改代码浏览器不变」时，先怀疑 **304**，再查业务。每条响应都个性化还全站强开 ETag，算摘要白耗 CPU。与 [Compress](/zh/plugins/compress) 叠用时按部署验一遍中间件与网关顺序，以真实 304/体积行为为准。

## 下一步

- 压缩：[Compress](/zh/plugins/compress)
- 静态目录：[静态文件](/zh/plugins/serve-static)
- 约束响应形态：[约束响应](/zh/web/response)