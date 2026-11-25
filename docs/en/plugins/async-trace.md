---
outline: deep
---

# Async Trace

Access logs only tell you “this request took 800ms”. To find **which awaits ate the time**, collect a tree for this request—useful for slow-endpoint triage and breaking down a chain of IO in a Service. Everyday CRUD doesn’t need this by default; for standard distributed tracing see OpenTelemetry—this package is lighter and aimed at in-app debugging.

```bash
pnpm add @aomex/async-trace
```

## Wrap the whole request

Mount `traceMiddleware` on `WebApp.mount` (or a Router group): each request opens a root node; the second argument is a callback after the request ends—good for “only log slow requests” before wiring to your logger.

```typescript
import { asyncTrace, traceMiddleware } from '@aomex/async-trace';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:8]
    traceMiddleware('request', (record) => {
      if (record.duration > 500) {
        void asyncTrace.toStack([record]);
      }
    }),
    routers('./src/routers'),
  ],
});
```

After mounting, the Web context merges **AsyncTraceMiddlewareProps**: you can use `ctx.asyncTrace.record` on the request (follow the type hints for fields). If you expect `ctx.asyncTrace` without mounting, neither types nor runtime will have a root record—either mount the middleware or use local `traceBlock` only.

`traceMiddleware` is a **mixin** middleware, not a `middleware.web`-only factory, but you can put it directly in Web mount; Console / command mount works the same. When only one API group is slow and you don’t want site-wide overhead, mount it on that Router’s mount.

::: warning
Logging full stacks with no sampling in production has runtime cost; in the callback, gate by duration or sampling before sending to your log system.
:::

## Break down hotspots in a Service

A whole-request span only shows total duration; to split “which DB call was slow”, wrap an await with `traceBlock` in the Service. Nested blocks print as an indented structure via `toStack`.

```typescript
import { traceBlock } from '@aomex/async-trace';

async loadUser(id: number) {
  return traceBlock('loadUser', async () => { // [!code focus:5]
    const profile = await db.profile.find(id);
    const prefs = await db.prefs.find(id);
    return { profile, prefs };
  });
}
```

For class methods with several awaits, a decorator is cleaner than hand-written `traceBlock`; without a label the default looks like `ClassName.methodName`, which is easy to spot in the stack:

```typescript
import { traceMethod } from '@aomex/async-trace';

class UserService {
  @traceMethod() // [!code highlight]
  async load() {
    return [];
  }
}
```

`asyncTrace.run(label, callback)` opens a child node inside an already-started tree. Records usually include label, duration, parent / children, error, and so on—often watching duration and label is enough when debugging.

Complements [@aomex/access-log](/en/plugins/access-log): access logs record total duration; async trace splits sub-steps. This package doesn’t replace OpenTelemetry or other distributed traces—cross-service still needs a standard approach.

## Related

- Middleware order: [Web app](/en/web/), [Custom middleware](/en/advanced/middleware)
- Attach requestId to logs: [Logger · withBindings](/en/core/logger#request-scoped-context-withbindings)
