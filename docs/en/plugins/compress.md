---
outline: deep
---

# Response compression

Compress large JSON or report responses when clients send `Accept-Encoding`—gzip / br / zstd, etc.—to save bandwidth.

**Prefer compression at Nginx (or CDN) in production**—less Node CPU and aligns with static assets and TLS termination. Use in-app `@aomex/compress` only for local direct access, no reverse proxy, or when the gateway cannot negotiate an encoding yet. Skip small bodies and already-compressed assets (images, video).

```bash
pnpm add @aomex/compress
```

## Mount on WebApp

After confirming the edge is **not** compressing the same responses, add `compress()` to `WebApp.mount`. Compression runs **after** `await next()` from `Accept-Encoding`; handlers still `ctx.send`—no gzip checks in actions.

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

`compress()` adds `CompressProps`: `ctx.needCompress` can force on/off per route (autocomplete shows the field). Responses get `Content-Encoding`; streaming types like `text/event-stream` are usually skipped to avoid buffering the whole stream.

## Threshold and algorithms

| Option | When to use | Default |
| --- | --- | --- |
| `threshold` | Skip tiny bodies to save CPU | `1024` |
| `filter` | Globally skip non-compressible MIME; overridable by `ctx.needCompress` | MIME-based |
| `zstd` / `br` / `gzip` / `deflate` | Disable unused algorithms | all enabled |
| `ctx.needCompress` | Per-route exceptions: SSE, large downloads | follows `filter` |

When the client supports multiple: **zstd → br → gzip → deflate**.

### Large lists / exports

```typescript
compress({ threshold: '4kb' });
```

### SSE must disable compression

```typescript
router.get('/events', {
  action: async (ctx) => {
    ctx.needCompress = false; // [!code highlight]
    ctx.send(sseStream);
  },
});
```

Typical order: access log / response time → compress → routes (compress needs final body).

| Environment | Guidance |
| --- | --- |
| Local direct Node | `compress()` OK to inspect size |
| Production with Nginx / CDN | **compress at edge**; avoid in-app double compression |
| Edge cannot compress yet | in-app `compress()` and disable duplicate gateway module |

::: tip
Nginx often uses `gzip on;` (plus Brotli modules if needed). Pick **either** gateway or app.
:::

::: warning
Gateway + app compression rarely shrinks more; latency and CPU often double.
:::

Streaming routes without `ctx.needCompress = false` buffer and break real-time behavior. With [ETag](/en/plugins/etag), verify order with real requests for 304 and size.

## Next steps

- Conditional cache: [ETag](/en/plugins/etag)
- Precompressed static: [Serve static](/en/plugins/serve-static)
- Timing header: [Response time](/en/plugins/response-time)