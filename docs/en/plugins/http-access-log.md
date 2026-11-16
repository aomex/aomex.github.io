---
outline: deep
---

# HTTP access log

One access line per finished request: method, URL, status, duration—for traffic and slow-endpoint views.

**Prefer Nginx `access_log` in production** (or gateway/LB built-in logs): consistent format, less Node event-loop load, easier ingestion. `@aomex/http-access-log` fits local dev, no reverse proxy, or when logs need **userId / tenant / traceId** only available inside the app.

```bash
pnpm add @aomex/http-access-log
```

## Mount early site-wide

Put `httpAccessLog()` **before** `routers` when you want in-app access logs: combined-style line after the request; 404 and validation 400 still count. Mounting later skews full-chain duration.

```typescript
import { httpAccessLog } from '@aomex/http-access-log';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    httpAccessLog(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

Default is combined-like one-liner via logger (often console). Fields roughly: ip, method, url, statusCode, duration, contentLength.

::: warning
After `routers`, chain duration and early 404 may not match “full site audit” intent.
:::

`customTokens` receive `WebContext`: `ctx.auth` etc. need **inner auth** to finish—access log writes after `await next()`, usually seeing onion inner props. If `customTokens` always read `-` for `ctx.auth`, check order: auth on routes with log outside may need auth lifted to `Router.mount`.

## Format and sinks

| Capability | When to use | Default |
| --- | --- | --- |
| `format` | Align ELK/Loki field order in prod | built-in combined style |
| `transports` | File, remote collectors | console (via `logger`) |
| `customTokens` | userId, tenant, traceId | — |
| `HttpAccessLogToken.*` | Compose `ip` / `method` / `duration` etc. | exported by package |

### Production: file

```typescript
import { HttpAccessLogToken, httpAccessLog } from '@aomex/http-access-log';
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

### userId after auth

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

Often paired with [Response time](/en/plugins/response-time): header for client/gateway, `duration` in logs for the platform.

| Environment | Guidance |
| --- | --- |
| Local direct | This plugin to console; add `responseTime()` for slow-route debugging |
| Production with Nginx | **Prefer** `access_log`; enable app layer only for custom tokens |
| Production no proxy | File or ship to collector; keep separate from business logs |

Access logs suit traffic and latency—not the sole audit trail for sensitive actions; add business logs or audit tables. Nginx and in-app logs can coexist—avoid two conflicting field schemas.

## Next steps

- Header timing: [Response time](/en/plugins/response-time)
- Levels and requestId: [Logger · withBindings](/en/core/logger#request-scoped-context-withbindings)