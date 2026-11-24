---
outline: deep
---

# Static files

Map a directory on disk (frontend dist, public, download packages) to HTTP file responses; on miss, `next()` hands off to later APIs. Serve only the `root` you choose—do not point at the project root or `node_modules`.

```bash
pnpm add @aomex/serve-static
```

## Before routers

Static middleware usually sits **before** business routes (try the file first, then hit the API). `root` is required and should point at frontend build output or a download directory.

```typescript
import { serveStatic } from '@aomex/serve-static';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'en-US' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    serveStatic({ root: './public' }), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

Plain WebMiddleware. On a hit it sends the file; on a miss it continues. Path traversal, `..`, NUL, dotfiles, and similar are rejected (checks live inside the package). Directory requests fall back to `index.html` by default (change with `indexFile`). When the build already emits sidecar `.br` / `.gz` files, `useCompressedFile` prefers them by default (you can turn that off).

::: warning
`root: '.'` or a directory that contains `node_modules` risks path leaks—misconfiguration has shown up in production.
:::

## Hashed chunks: long cache

JS/CSS chunks with a content hash can use a long `cacheControl`; entry files such as `index.html` should not be equally `immutable`, or users keep an old shell after you ship.

```typescript
serveStatic({
  root: './dist',
  cacheControl: { // [!code highlight]
    maxAge: 86_400_000,
    immutable: true,
  },
});
```

Default `maxAge: 0`. Prefer short cache or `noCache` for HTML.

## URL prefix vs disk path

When CDN / gateway maps `/assets/...` to `./dist`, use `formatPath` to strip the prefix before looking up the file:

```typescript
serveStatic({
  root: './dist',
  formatPath: (pathname) => { // [!code highlight]
    const trimmed = pathname.replace(/^\/assets/, '');
    return trimmed || '/';
  },
});
```

## API + SPA fallback

Deep-link refresh cannot rely on static middleware alone: after routers, fall back to `index.html` for misses. `send` and `serveStatic` are exported from the same package.

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

| Environment | Recommendation |
| --- | --- |
| Production | Heavy traffic often hands static to CDN/Nginx; Node still fits fallback or intranet |
| Local | Point `serveStatic` at Vite build output |

## Next steps

- Conditional caching: [ETag](/en/plugins/etag)
- Transfer compression: [Compress](/en/plugins/compress)
- Assembling the Web entry: [App entry](/en/web/)
