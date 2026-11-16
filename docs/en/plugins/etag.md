---
outline: deep
---

# ETag

Computes entity tags for successful GET/HEAD responses: when the client sends `If-None-Match` and content is unchanged, respond **304** and save bandwidth. Good for semi-static config and version info; highly personalized lists rarely benefit.

```bash
pnpm add @aomex/etag
```

## Mount on WebApp

Add `etag()` to `WebApp.mount`; successful GET/HEAD responses get an ETag automatically. Matching `If-None-Match` on unchanged content yields 304. Handlers still use `ctx.send` as usual.

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

Handlers still `ctx.send(data)`; when the tag matches and content is fresh, middleware returns 304 with an empty body.

Plain `WebMiddleware`—no new `ctx` fields. First response carries ETag; a repeat request with matching `If-None-Match` → **304**. Existing `Etag` header, non-2xx, or non GET/HEAD usually skip rewriting.

## Weak validation and stacking

| Option | When to use | Default |
| --- | --- | --- |
| `weak` | Semantically equivalent content is enough for 304; strong wants byte identity | `false` (`ReadStream` often weak) |

```typescript
mount: [etag({ weak: true })];
```

### Semi-static API (often on in production)

```typescript
router.get('/api/config', {
  action: async (ctx) => {
    ctx.send(await loadPublicConfig());
  },
});
```

### Static assets + compression

```typescript
mount: [
  etag(), // [!code highlight]
  compress(),
  serveStatic({ root: './dist' }),
  routers('./src/routers'),
],
```

| Environment | Guidance |
| --- | --- |
| Production | Enable for static and semi-static endpoints; skip forcing site-wide ETag on per-user “my orders” style APIs |
| Local | If JSON debugging looks stuck, disable or hard-refresh; re-enable when testing conditional requests |

```typescript
mount: [
  ...(process.env.NODE_ENV === 'production' ? [etag()] : []),
  routers('./src/routers'),
],
```

At high scale you may cache at the CDN; in-app ETag helps when you still control 304 semantics.

If code changes do not show in the browser locally, suspect **304** before business logic. Site-wide strong ETag on every personalized response wastes CPU hashing. With [Compress](/en/plugins/compress), verify middleware and gateway order in deployment—trust real 304/size behavior.

## Next steps

- Compression: [Compress](/en/plugins/compress)
- Static directories: [Serve static](/en/plugins/serve-static)
- Response shaping: [Response constraints](/en/web/response)