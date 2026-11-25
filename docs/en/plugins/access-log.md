---
outline: deep
---

# Access log

Want to see “who hit which HTTP route and how long it took” inside the app? Use `httpAccessLog()` from `@aomex/access-log`. One line when the request finishes.

**Prefer Nginx `access_log` in production** (or the gateway’s built-in log). This package fits local development, no reverse proxy, and cases where the line must include **userId / tenant / traceId**—fields you only have after entering Node.

```bash
pnpm add @aomex/access-log
```

## Mount before routers

Put `httpAccessLog()` **before** `routers`. After the onion finishes, one line is written; 404 and validation 400 still count. Mount too late and duration / early exits will not match the “full site audit” you want.

```typescript
import { httpAccessLog } from '@aomex/access-log';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'en-US' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    httpAccessLog(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

With no options, lines go to the console in a combined-ish style: ip, method, url, statusCode, duration, contentLength. Mount it for local direct access; add [Response time](/en/plugins/response-time) when you chase slow routes.

::: warning
Mounted **after** routers, full-chain duration and early-exit 404s may not match a “full site audit.”
:::

## Format and write to a file

To align field order with ELK / Loki, or write to a file, use `format` + `transports`. Prefer composing `format` from `HttpAccessLogToken` instead of hand-typed placeholders that are easy to mistype.

```typescript
import { HttpAccessLogToken, httpAccessLog } from '@aomex/access-log';
import { FileTransport } from '@aomex/logger';

httpAccessLog({
  format: [
    HttpAccessLogToken.ip,
    HttpAccessLogToken.method,
    HttpAccessLogToken.url,
    HttpAccessLogToken.statusCode,
    HttpAccessLogToken.duration,
    HttpAccessLogToken.contentType,
  ].join(' '),
  transports: [new FileTransport({ file: './logs/access.log' })], // [!code highlight]
});
```

Empty `transports` or `disabled: true` turns access logging off. With Nginx in production, **prefer** the gateway `access_log`; only open app-layer disk / collectors when you need custom tokens or there is no reverse proxy—and keep them separate from business logs.

## Add userId

The line is written **after** `await next()`, so `ctx.auth` hung by inner auth is usually readable. Use `customTokens` to inject business fields into `format`; the callback receives the full `WebContext`.

```typescript
httpAccessLog({
  format: `${HttpAccessLogToken.method} ${HttpAccessLogToken.url} [userId] ${HttpAccessLogToken.statusCode}`,
  customTokens: { // [!code highlight]
    userId: (ctx) => {
      return String(ctx.auth?.bearer?.data?.userId ?? '-');
    },
  },
});
```

Often paired with [Response time](/en/plugins/response-time): `X-Response-Time` for clients / gateways, duration in the log for collectors.

Access logs are for traffic and latency—**not** the only audit for sensitive actions. Orders and permission changes still belong in business logs or an audit table.

## Next

- Response header timing: [Response time](/en/plugins/response-time)
- WebSocket connection / message access logs: [Access log (WebSocket)](/en/websocket/access-log)
- Levelled sinks / requestId: [Logger](/en/core/logger)
