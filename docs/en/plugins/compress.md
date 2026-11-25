---
outline: deep
---

# Response compression

For large JSON and report-style APIs, compress with gzip / br / zstd when the client sends `Accept-Encoding`, to cut bandwidth.

**In production, prefer compressing at Nginx (or a CDN).** That keeps CPU off the Node process and sits naturally next to static assets and TLS termination. Only mount `@aomex/compress` in the app when you connect to Node directly, have no reverse proxy, or the gateway cannot compress a given encoding yet. Skip small responses and already-compressed assets (images, video) so you do not burn CPU for nothing.

```bash
pnpm add @aomex/compress
```

## Mount on WebApp

After you confirm the edge is **not** already compressing the same response, put `compress()` in `WebApp.mount`. Compression runs **after** `await next()` based on `Accept-Encoding`; business code still `ctx.send` as usual—no need to branch on gzip inside the action.

```typescript
import { compress } from '@aomex/compress';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'en-US' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    compress(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

`compress()` accepts CompressProps: `ctx.needCompress` can force compression on or off for a single route (autocomplete will show the field). Responses get `Content-Encoding`; streaming types such as `text/event-stream` are usually skipped so the whole stream is not buffered.

Common mount order: access log / response time → compress → routers (compression needs the final body). Algorithm preference when the client supports several: **zstd → br → gzip → deflate**.

## Raise the threshold for large lists

Bodies smaller than about `1024` bytes are not compressed by default, to save CPU. For exports and large lists, set `threshold` to something like `'4kb'`; a bare number (or a value without a unit) is in bytes.

```typescript
compress({ threshold: '4kb' }); // [!code highlight]
```

To allow only one algorithm, set the others to `false` (e.g. `br: false`). `filter` decides by Content-Type; a per-route `ctx.needCompress` can override it.

## Turn compression off for SSE

If a streaming endpoint forgets to disable compression, buffering breaks real-time delivery. Set `ctx.needCompress` to `false` in the action:

```typescript
router.get('/events', {
  action: async (ctx) => {
    ctx.needCompress = false; // [!code highlight]
    ctx.send(sseStream);
  },
});
```

| Environment | Recommendation |
| --- | --- |
| Local direct to Node | Mount `compress()` to watch payload size |
| Production with Nginx / CDN | **Prefer edge compression**; do not also mount in the app (avoids double compression) |
| Edge cannot compress yet | Then consider in-app `compress()`, and disable the same modules on the gateway |

::: tip
A common Nginx setup is `gzip on;` (plus a Brotli module when needed). Use **either** the app **or** the gateway—not both.
:::

::: warning
Compressing at both gateway and app rarely shrinks the payload further; latency and CPU often double.
:::

When stacking with [ETag](/en/plugins/etag), do not assume mount order—verify 304 and payload size with real requests after you change it.

## Next steps

- Conditional caching: [ETag](/en/plugins/etag)
- Precompressed static files: [Static files](/en/plugins/serve-static)
- Response timing header: [Response time](/en/plugins/response-time)
