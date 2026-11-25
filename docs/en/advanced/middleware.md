---
outline: deep
---

# Custom middleware

On [Middleware](/en/core/middleware), `middleware.mixin`, `.skip()` (function or `boolean`), and `dependsOn` (type-only upstream borrow) cover everyday composition. You are usually here because **runtime behavior and OpenAPI / CLI help must stay in sync**—one middleware, one place to change both.

The steps below follow **Web doc hooks → Console help → cross-stage reuse**. Work through them and you will have a trace middleware that shows up in Swagger once mounted.

## Choose mixin vs web / console first

| What you need | Use |
| --- | --- |
| Only change runtime `ctx`; docs can ignore it | `middleware.mixin` (see [Middleware](/en/core/middleware)) |
| Web: runtime + patch OpenAPI operation | `middleware.web({ fn, openapi })` |
| Console: runtime + contribute to `--help` tree | `middleware.console({ fn, help })` |

A `middleware.web` instance **cannot** mount on Console as-is; the reverse is also true. When you need both, extract shared logic into a plain function and wrap each side.

## Step 1: Get runtime working first

Goal: every request carries a `traceId` that downstream actions can read.

```typescript
// src/middleware/trace-id.ts
import { middleware } from '@aomex/common';

export const traceId = middleware.web<{ // [!code highlight]
  readonly traceId: string;
}>({
  fn: async (ctx, next) => {
    ctx.traceId = crypto.randomUUID();
    await next();
  },
});
```

After you put the generic `{ readonly traceId: string }` on `middleware.web`, **later middleware and actions on the same route** get `ctx.traceId` in the type checker. Assign without the generic and the field exists at runtime but TypeScript still treats it as missing.

Mount on the app or a route and try it:

```typescript
import { routers, WebApp } from '@aomex/web';
import { traceId } from '@/middlewares/trace-id';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [
    traceId, // [!code highlight]
    routers('./src/routers'),
  ],
});
```

```typescript
action: async (ctx) => {
  logger.info(`ok ${ctx.traceId}`);
  ctx.send({ ok: true });
};
```

Swagger still will not mention trace at this point—runtime and docs are injected separately.

## Step 2: Add the OpenAPI hook

In the same `middleware.web` options object, add `openapi`. When routes are scanned for doc generation, the framework calls these hooks so you can patch the current operation (or the whole document).

Common entry points (pick from the type hints; you do not need all of them):

| Hook | When to use it |
| --- | --- |
| `onMethod` | Add parameters, responses, or security on **this** operation |
| `postMethod` | Finalize after others (e.g. unified envelope) |
| `onDocument` | Register global blocks such as `components.securitySchemes` |

Document a response header on every route that mounts `traceId`:

```typescript
import { middleware } from '@aomex/common';

export const traceId = middleware.web<{
  readonly traceId: string;
}>({
  fn: async (ctx, next) => {
    ctx.traceId = crypto.randomUUID();
    ctx.response.setHeader('X-Trace-Id', ctx.traceId);
    await next();
  },
  openapi: { // [!code focus:14]
    onMethod(methodItem) {
      methodItem.responses ||= {};
      const ok = methodItem.responses['200'];
      if (ok && typeof ok === 'object' && 'description' in ok) {
        ok.headers ||= {};
        ok.headers['X-Trace-Id'] = {
          schema: { type: 'string', format: 'uuid' },
          description: '请求追踪 ID',
        };
      }
    },
  },
});
```

Re-run [Generate OpenAPI](/en/openapi/) or open Swagger: operations with this middleware should show `X-Trace-Id`. Bad structure in hooks will not fail `pnpm start`; verify in the generated output.

::: tip
If the middleware **does nothing at runtime** and only exists for docs, ask whether route `docs` or generator config is enough—an empty layer makes `mount` harder to read.
:::

## Step 3: Same pattern on Console

When a command needs extra text in `--help`, use `middleware.console` + `help`:

```typescript
import { middleware } from '@aomex/common';

export const withDryRunFlag = middleware.console({ // [!code highlight]
  fn: async (ctx, next) => {
    await next();
  },
  help: {
    onDocument(doc) {
      // Contribute to the help tree per type hints; exact fields follow editor completion
    },
  },
});
```

Mount on `commander.create`’s `mount`, symmetric to Web `openapi`: HTTP contract on one side, CLI help on the other.

## Step 4: Share logic across both sides

Do not duplicate UUID logic. Extract a function, then wrap:

```typescript
import { middleware } from '@aomex/common';

const assignTraceId = (ctx: { traceId: string }) => {
  ctx.traceId = crypto.randomUUID();
};

export const webTraceId = middleware.web<{ readonly traceId: string }>({
  fn: async (ctx, next) => {
    assignTraceId(ctx);
    await next();
  },
  openapi: {
    /* same as above */
  },
});

export const consoleTraceId = middleware.console<{ readonly traceId: string }>({
  fn: async (ctx, next) => {
    assignTraceId(ctx);
    await next();
  },
});
```

## What you usually see when something is wrong

| Symptom | Likely cause |
| --- | --- |
| No `ctx.traceId` completion in action | Missing Props generic on `middleware.web` / `mixin` |
| Header at runtime, nothing in Swagger | `fn` without `openapi`, or generation did not scan routes that mount this middleware |
| Type error mounting `middleware.web` on Console | Wrong stage; use `middleware.console` |
| Health checks still blocked by auth | Use `.skip()`; see [Middleware · skip](/en/core/middleware#skip-certain-requests) |

## Related

- Order, `.skip()`, `dependsOn`, ctx merging: [Middleware](/en/core/middleware)
- Ready-made plugins: [HTTP access log](/en/plugins/access-log), [Auth entry](/en/plugins/auth)
- Doc generation: [Generate OpenAPI](/en/openapi/)