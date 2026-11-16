---
outline: deep
---

# Async trace

Access logs tell you “this request took 800ms.” To see **which awaits cost time**, build a tree inside the request—good for slow routes and profiling a chain of IO in services. Skip for everyday CRUD; for standard distributed tracing use OpenTelemetry—this package is lighter and in-process.

## Full-request traceMiddleware

Install when needed:

```bash
pnpm add @aomex/async-trace
```

Wrap the whole request:

```typescript
import { asyncTrace, traceMiddleware } from '@aomex/async-trace';

mount: [
  traceMiddleware('request', (record) => { // [!code highlight]
    if (record.duration > 500) {
      void asyncTrace.toStack([record]);
    }
  }),
  routers('./src/routers'),
],
```

Without `traceMiddleware`, `ctx.asyncTrace` will not exist at runtime or in types—either mount it or use local `traceBlock` only.

Local blocks inside services:

```typescript
import { traceBlock } from '@aomex/async-trace';

const data = await traceBlock('loadUser', async () => { // [!code highlight]
  const profile = await db.profile.find();
  const prefs = await db.prefs.find();
  return { profile, prefs };
});
```

Method decorator (cleaner than manual `traceBlock` when a method has many awaits):

```typescript
import { traceMethod } from '@aomex/async-trace';

class UserService {
  @traceMethod() // [!code highlight]
  async load() {
    return [];
  }
}
```

Without a label, default is like `ClassName.methodName`—easy to read in stacks.

After `traceMiddleware`, Web context merges **AsyncTraceMiddlewareProps**: use **ctx.asyncTrace.record** in the request (exact fields from type hints). `traceMiddleware` is a **mixin** middleware—not exclusive to `middleware.web`—fits Web mount; Console / command mount too. `asyncTrace.run(label, callback)` opens child nodes; nested `toStack` prints indented structure. Records usually carry label, duration, parent/children, error—duration and label often enough for debugging.

## Mount levels and callbacks

| Scenario | Usage |
| --- | --- |
| Whole HTTP site | `WebApp.mount: [traceMiddleware('http')]` |
| One API group | `Router.mount: [traceMiddleware('api-v1')]` |
| Console jobs | `ConsoleApp` / command `mount` |
| Hot methods | `@traceMethod()` or `traceBlock` |
| Log slow requests | `traceMiddleware` second-arg `callback`—avoid unconditional full stacks on hot paths in prod |

::: warning
Unbounded stack dumps in production cost CPU; threshold or sample in the callback before shipping to logging.
:::

Complements [@aomex/http-access-log](/en/plugins/http-access-log): access log = total time, trace = substeps. Does not replace OpenTelemetry for cross-service traces.

## Related

- Middleware order: [Web app](/en/web/), [Custom middleware](/en/advanced/middleware)
- requestId in logs: [Logger · withBindings](/en/core/logger#request-scoped-context-withbindings)