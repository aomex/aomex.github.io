---
outline: deep
---

# Static files

Map a disk directory (frontend `dist`, `public`, downloads) to HTTP file responses; on miss, `next()` to API routes. Only serve your chosen `root`—not project root or `node_modules`.

```bash
pnpm add @aomex/serve-static
```

## Before API routes

Static middleware usually sits **before** business routes (try file first, then API).

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

Plain `WebMiddleware`. Hits send file content; misses pass through. Path traversal, `..`, NUL, dotfiles are rejected (validation inside the package).

## root and caching

| Option | When to use | Default |
| --- | --- | --- |
| `root` | Frontend build or download dir | **required** |
| `formatPath` | URL prefix differs from disk (e.g. `/assets`) | — |
| `indexFile` | Directory requests fall back to index | `index.html` |
| `useCompressedFile` | Build emits sidecar `.br`/`.gz` | `true` |
| `cacheControl` | Long cache for hashed assets; short or `noCache` for HTML | `maxAge: 0` |

### Long cache (hashed chunks)

```typescript
serveStatic({
  root: './dist',
  cacheControl: { // [!code highlight]
    maxAge: 86_400_000,
    immutable: true,
  },
});
```

### URL prefix rewrite

```typescript
serveStatic({
  root: './dist',
  formatPath: (pathname) => { // [!code highlight]
    const trimmed = pathname.replace(/^\/assets/, '');
    return trimmed || '/';
  },
});
```

### API + SPA fallback (deep links → index.html)

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

| Environment | Guidance |
| --- | --- |
| Production | High traffic often uses CDN/Nginx; Node still OK for fallback or internal |
| Local | Point `serveStatic` at Vite build output |

::: warning
`root: '.'` or directories containing `node_modules` risk path leaks—misconfigs happen in production.
:::

Do not give `index.html` the same `immutable` long cache as hashed chunks—or users keep an old shell after deploy. SPA deep links need fallback **after** `routers` to `index.html` (see demo above).

## Next steps

- Conditional cache: [ETag](/en/plugins/etag)
- Transfer compression: [Compress](/en/plugins/compress)
- Web assembly: [App entry](/en/web/)