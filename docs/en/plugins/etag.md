---
outline: deep
---

# ETag

Compute an entity tag for successful GET/HEAD responses: when the client sends If-None-Match and the content has not changed, return **304** and save bandwidth. Good for semi-static config and version info; highly personalized lists usually gain little.

```bash
pnpm add @aomex/etag
```

## Mount on WebApp

Mount `etag()` in `WebApp.mount`; successful GET/HEAD responses get an ETag automatically. When the client sends If-None-Match and nothing changed, you get 304. Business code still `ctx.send` as usual.

```typescript
import { etag } from '@aomex/etag';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'en-US' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    etag(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

Business still `ctx.send(data)`; on a match that is still “fresh”, the middleware returns 304 with an empty body.

Plain WebMiddleware—no new `ctx` fields. On the wire: first response carries ETag; a later request with a matching If-None-Match → **304**. Existing Etag header, non-2xx, or non-GET/HEAD usually leave the response alone.

::: tip
With site-wide [response envelope](/en/web/envelope), the envelope rewrites the body and sets the outer status to 200; the framework **strips the original ETag** so the digest does not still describe the pre-envelope body. For endpoints that need conditional caching, make sure the digest is computed after the envelope, or `skipEnvelope` on that exit.
:::

## Semi-static APIs

For public config, version info, and other GET responses that barely change for a while, mounting site-wide is enough; the action still loads from the DB and `send`s as usual:

```typescript
router.get('/api/config', {
  action: async (ctx) => {
    ctx.send(await loadPublicConfig());
  },
});
```

When you build JSON dynamically but a semantic match should still 304, turn on weak validation: `etag({ weak: true })` (strong by default; `ReadStream` often uses weak). Highly personalized lists such as “user orders” do not need a site-wide hard enable.

## Static + compression

When static directories and compression sit next to each other, put ETag earlier so the digest sees content before the final write (confirm with real 304 / size behavior):

```typescript
mount: [
  etag(), // [!code highlight]
  compress(),
  serveStatic({ root: './dist' }),
  routers('./src/routers'),
],
```

When local JSON debugging is hidden by 304, leave it unmounted or hard-refresh; turn it back on when you test conditional requests:

```typescript
mount: [
  ...(process.env.NODE_ENV === 'production' ? [etag()] : []),
  routers('./src/routers'),
],
```

| Environment | Recommendation |
| --- | --- |
| Production | Enable for static and semi-static endpoints; personalized APIs need not force site-wide |
| Local | If debugging is blocked by 304, unmount or hard-refresh |

Under heavy traffic you can also hand caching to a CDN; in-app ETag fits when you still want to own 304 semantics. Forcing ETag site-wide on every personalized response wastes CPU on digests.

## Next steps

- Compression: [Compress](/en/plugins/compress)
- Static directories: [Static files](/en/plugins/serve-static)
- Shape responses: [Constrain response](/en/web/response)
