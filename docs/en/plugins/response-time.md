---
outline: deep
---

# Response time

Writes server processing time into each response header (e.g. `X-Response-Time`) for browsers, gateways, and integration tests watching slow endpoints. No options—mount and go.

```bash
pnpm add @aomex/response-time
```

## Next to access logs

`responseTime()` has no config; mount it beside access logging. After the request finishes, the header carries duration. Complements Nginx `access_log` / [httpAccessLog](/en/plugins/http-access-log) `duration` (header for client/gateway, log for platform aggregation). Production access logs still prefer the edge; this plugin only answers “should the response header include timing?”.

```typescript
import { responseTime } from '@aomex/response-time';
import { httpAccessLog } from '@aomex/http-access-log';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:5]
    responseTime(), // [!code highlight]
    httpAccessLog(),
    routers('./src/routers'),
  ],
});
```

Uses `process.hrtime`; headers often look like `12.345ms`. Failed responses get a value too; error paths may merge into `HttpError.headers`.

Plain `WebMiddleware`—business `ctx` types unchanged. Read it in the Network panel; no need to set headers in actions.

## Response header vs access log

| Output | Audience | Notes |
| --- | --- | --- |
| `X-Response-Time` | Browser, API gateway, test assertions | Same behavior site-wide, independent of route changes |
| Access log `duration` | Log platform, alerts, per-route aggregation | See [HTTP access log](/en/plugins/http-access-log) |

No option table: **want the header—mount it; don’t—omit it.** Usually sits before `routers`, near access logging.

| Environment | Guidance |
| --- | --- |
| Production | Often paired with `httpAccessLog()` |
| Local | If you only tail the console, access log alone may be enough |

`X-Response-Time` is not end-to-end time—gateways, TLS, and client queuing come before it. Strip the header at the edge on public APIs if you worry about leakage; internal or first-party frontends usually do not. If you only enable `responseTime` without persistence, peak troubleshooting still needs log aggregation `duration` (see [HTTP access log](/en/plugins/http-access-log)).

## Next steps

- Access logging: [HTTP access log](/en/plugins/http-access-log)
- Distributed tracing: [Async trace](/en/plugins/async-trace)
- [Middleware](/en/core/middleware)