---
outline: deep
---

# Web app entry

Start the HTTP server: fill required `WebApp` options and mount routes with `routers('./src/routers')`. Below covers site language, client IP, body limits, and `ctx.send` / `ctx.throw` / `ctx.redirect`.

```bash
pnpm add @aomex/web @aomex/common @aomex/logger
pnpm add tsx -D
```

```typescript
// src/web.ts
import { routers, WebApp } from '@aomex/web';
import { services } from './services/index.js';

const app = new WebApp({ // [!code focus:7]
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [routers('./src/routers')], // [!code highlight]
});

app.listen(3000, () => {
  console.log('HTTP server started');
});

declare module '@aomex/web' {
  namespace WebApp {
    type T = WebApp.Infer<typeof app>;
    interface Props extends T {}
  }
}
```

Missing any required `services`, `logger`, `language`, or `proxyIP` on `new WebApp({ ... })` fails at compile time. Global `mount` fields on `ctx` via `middleware.web` need the `declare module` above—or runtime has values TypeScript does not, and you cast everywhere. With [response()](/en/web/response) on routes, `ctx.send` / `ctx.throw` body types narrow accordingly.

::: warning
Global `mount` adds `ctx` fields without `declare module` → runtime values, missing types, casts everywhere.
:::

```bash
node --import tsx/esm --watch src/web.ts
```

Open [http://localhost:3000](http://localhost:3000). Put the start command in `package.json` `scripts` so the team uses `pnpm start`.

These fields live on `new WebApp({ ... })`. Routes answer “what this path does”; these answer “how the site runs”.

## services and logger

`services` is the business container (DB, cache, mail, etc.) from [combineServices](/en/core/service). On shutdown the framework calls `destroy` on loaded services to close connections and flush logs.

`logger` must be passed again (usually `services.logger`): `ctx.logger` in routes and middleware is that instance—same reference as the constructor arg.

```typescript
const app = new WebApp({
  services, // [!code highlight]
  logger: services.logger, // [!code highlight]
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

## language

Controls **body() / query() validation errors and framework messages**. Use `zh-CN`, `en-US` (hyphens—not `zh_CN`). Framework copy only—not Ant Design / Day.js locale or your product strings ([Advanced: app i18n](/en/advanced/i18n)).

| Mode | When to use |
| --- | --- |
| `fixed` + `language` | Internal admin, single-locale SaaS |
| `dynamic` | Public multi-client API, negotiate per request |
| `header: 'accept-language'` | Browsers, standard clients (RFC `q` order) |
| `header: 'x-language'` | Custom app header (comma-separated, usually no `q`) |
| `fallback` | When header missing or unknown |

Fixed:

```typescript
language: { mode: 'fixed', language: 'zh-CN' },
```

`Accept-Language` negotiation:

```typescript
language: {
  mode: 'dynamic', // [!code highlight]
  header: 'accept-language',
  fallback: 'zh-CN',
},
```

Custom header:

```typescript
language: {
  mode: 'dynamic',
  header: 'x-language', // [!code highlight]
  fallback: 'zh-CN',
},
```

Try:

```bash
curl -H 'Accept-Language: en-US' http://localhost:3000/users
```

::: warning
Do not set language too late in middleware—earlier `body()` / `query()` may already have used defaults; use `WebApp.language` for framework messages. Console is string-only—see [Console app entry](/en/console/#language).
:::

## proxyIP

Fills `ctx.request.ip`. Misconfiguration breaks rate limits and risk controls.

| Mode | When to use |
| --- | --- |
| `detect` | Local `tsx`, tests; unknown proxy setup |
| `specify` | Public production—trust only your proxy headers |

```typescript
proxyIP: { mode: 'detect' },
```

::: warning
Do not run `detect` on public internet long-term—clients can forge proxy headers. Use `specify` and trust only your reverse proxy.
:::

```typescript
proxyIP: {
  mode: 'specify', // [!code highlight]
  header: 'x-forwarded-for',
  hops: 1,
},
```

`hops` must match real proxy depth—or you read the wrong hop, CDN node, or internal IP.

| Topology | Typical config |
| --- | --- |
| Node on public internet / dev direct | `detect` or `specify` without proxy header |
| Single Nginx → Node | `specify` + `x-forwarded-for`, `hops: 1` |
| CDN + your Nginx | `x-forwarded-for`, `hops: 2` (adjust to reality) |
| Cloudflare only | `specify` + `cf-connecting-ip`, `hops: 1` |

```typescript
proxyIP: {
  mode: 'specify',
  header: 'cf-connecting-ip', // [!code highlight]
  hops: 1,
},
```

## mount

`mount` is the site middleware queue—array order, onion model, code before/after `await next()`. CORS, site-wide auth, access logs, and `routers('./src/routers')` go here.

Logic for one URL group belongs on [Router](/en/web/router) or per-route `mount`, not all on `WebApp`.

```typescript
import { middleware } from '@aomex/common';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:9]
    middleware.web(async (ctx, next) => { // [!code highlight]
      const start = Date.now();
      await next();
      const cost = Date.now() - start;
      const { method, url } = ctx.request;
      await ctx.logger.info(`${method} ${url} ${cost}ms`);
    }),
    routers('./src/routers'),
  ],
});
```

## shutdown

On `SIGTERM` / `SIGINT` (`docker stop`, Ctrl+C, K8s rolling), `WebApp` **gracefully shuts down**: stop accepting connections, drain in-flight requests, destroy services, exit 0.

`timeout` is max wait (default ~**5s**; milliseconds or `'10s'` strings). After timeout, connections force-close so the process does not hang deploys.

```typescript
shutdown: { timeout: 10_000 },
```

Rarely changed locally; in production with uploads, long poll, slow queries, size to worst-case request. No new requests during shutdown—load balancers should drain first. With [clusterListen](/en/advanced/cluster#clusterlisten), the primary also receives signals and coordinates worker exit.

## Site-wide body limits

Before large uploads or webhook JSON, check defaults; tighten or relax at app level.

| Kind | Typical Content-Type | Default (reference) |
| --- | --- | --- |
| `payload` | JSON, urlencoded, text in memory | ~`2mb`, overflow → **413** |
| `formData` | `multipart/form-data` | ~`50mb` per file, caps on file/field count |

```typescript
const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  body: { // [!code focus:8]
    payload: { maxSize: '1mb' }, // [!code highlight]
    formData: {
      maxFileSize: '20mb',
      maxFiles: 5,
      maxFields: 50,
    },
  },
  mount: [routers('./src/routers')],
});
```

Route [body()](/en/web/body) file fields and app `formData` use the **stricter** limit. Upload details: [File uploads](/en/web/attach).

Public webhooks or large JSON: whole body loads in memory; overflow is **413**, not validation **400**—route-only changes may be insufficient without app `body.payload`.

## envelope

When success and failure share one JSON wrapper with outer HTTP **200** (real status inside body), set `envelope` on `new WebApp`. Routes still `send` / `throw`; framework wraps at flush.

Tree uses `envelope.success` / `envelope.payload` / `envelope.statusCode` and optional `envelope.slot`; often with [formatError](/en/web/errors). For bare responses on specific statuses use `response({ skipEnvelope: true })`. Details and auto-skip rules (redirect, 204, SSE, etc.): [Response envelope](/en/web/envelope).

## listen, http, https

`listen` binds the server; without it only an in-memory `App` exists. `app.listen(port)` equals `app.http({}).listen(port)` for plain HTTP.

```typescript
app.http({ keepAliveTimeout: 65_000 }).listen(3000);
```

```typescript
import fs from 'node:fs';
import path from 'node:path';

app
  .https({
    key: fs.readFileSync(path.resolve('ca', 'cert.key')),
    cert: fs.readFileSync(path.resolve('ca', 'cert.pem')),
  }) // [!code highlight]
  .listen(443);
```

Production often terminates TLS at Nginx / Caddy and proxies to Node HTTP—pair with correct `proxyIP`.

Multi-process setups, Docker scale, K8s replicas, PM2, and `clusterListen`: [Multi-process and scaling](/en/advanced/cluster).

## ctx.send

In route actions or global middleware, omit status → default **200**; 201, 204, etc. need explicit first argument.

```typescript
router.get('/ping', {
  action: async (ctx) => {
    ctx.send('plain text'); // [!code highlight]
  },
});
```

```typescript
router.post('/users', {
  action: async (ctx) => {
    const user = await createUser(ctx.body);
    ctx.send(201, { id: user.id }); // [!code highlight]
  },
});
```

```typescript
router.delete('/sessions/current', {
  action: async (ctx) => {
    await revokeSession(ctx);
    ctx.send(204); // [!code highlight]
  },
});
```

## ctx.throw

Use **4xx / 5xx** only. Business rejection → `ctx.throw`, not `throw new Error`—exposed 4xx does not pollute logs as 5xx.

```typescript
router.get('/users/:id', { // [!code focus:12]
  mount: [params({ id: rule.int().min(1) })],
  action: async (ctx) => {
    const user = await findUser(ctx.params.id);
    if (!user) {
      ctx.throw(404); // [!code highlight]
    }
    if (!canView(ctx, user)) {
      ctx.throw(403, { code: 'FORBIDDEN' });
    }
    ctx.send(user);
  },
});
```

```typescript
ctx.throw(500, 'payment gateway timeout', { expose: true });
```

With `expose: true`, the response may include `message`—no SQL or internal paths.

## ctx.redirect

Permanent **301**; temporary often **302** (default when status omitted).

```typescript
router.get('/old-profile', {
  action: async (ctx) => {
    ctx.redirect(301, '/profile'); // [!code highlight]
  },
});
```

```typescript
router.get('/login-done', {
  action: async (ctx) => {
    ctx.redirect('/dashboard'); // [!code highlight]
  },
});
```

## download, sse, logger

Other exits—details on dedicated pages:

- `ctx.download`: stream files to client; Promise settles after stream ends—good for delete-after-download temps.
- `ctx.sse()`: server-sent events—[SSE](/en/web/sse).
- `ctx.logger`: the `logger` passed to `WebApp`; per-request fields—[Logger · withBindings](/en/core/logger#request-scoped-context-withbindings).

### app.on('error')

Uncaught exceptions in actions/middleware emit `error` on the app. Default logging respects `expose`; add listeners for Sentry, chat bots, etc.

**Do not mutate the response body here**—often too late. Unified JSON errors: [Error format](/en/web/errors); unified wrapper with HTTP 200: [Response envelope](/en/web/envelope).

## Next steps

- [HTTP routing](/en/web/router): split URLs and verbs by file
- [query](/en/web/query) / [params](/en/web/params) / [body](/en/web/body): input validation trio
- [Response constraints](/en/web/response): TypeScript and OpenAPI alignment
- [SSE](/en/web/sse): `ctx.sse` / stream / resume
- [Error format](/en/web/errors): JSON after `ctx.throw`
- [Response envelope](/en/web/envelope): unified JSON shell, HTTP 200
- [Multi-process and scaling](/en/advanced/cluster): Docker / K8s / PM2 / `clusterListen`