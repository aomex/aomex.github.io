---
outline: deep
---

# OpenAPI export

Write the contract scanned from routes to a **file** without starting the HTTP process—for CI, SDKs, or doc sites. How routes declare metadata and how `generateOpenapi` works: Web side [OpenAPI generation](/en/plugins/openapi).

```bash
pnpm add @aomex/openapi
```

Mount `openapi({ routers, app, saveToFile, … })` on `ConsoleApp`, run `aomex openapi` locally or in the pipeline, get `openapi.json` (or your path). Pass the same `WebApp` as production so global middleware and [envelope](/en/web/envelope) land in the document.

When passing `app`, **split** `new WebApp(...)` from `app.listen(...)` (or only listen in the entry)—otherwise Console `import` of the Web module may start the server as a side effect.

```typescript
// src/app.ts — export WebApp only, no listen
import { formatError, routers, WebApp } from '@aomex/web';
import { services } from './services/index.js';

export const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [formatError({ /* … */ }), routers('./src/routers')],
});
```

```typescript
// src/cli.ts
import { openapi } from '@aomex/openapi';
import { commanders, ConsoleApp } from '@aomex/console';
import { app } from './app.js';

new ConsoleApp({
  services,
  logger: services.logger,
  language: 'zh-CN',
  mount: [
    openapi({ // [!code focus:18]
      routers: './src/routers',
      app, // [!code highlight]
      saveToFile: 'openapi.json',
      docs: {
        info: {
          title: 'My API',
          version: '1.0.0',
        },
      },
      fix: (doc) => {
        doc.servers = [{ url: 'https://api.example.com' }];
        return;
      },
    }),
    commanders('./src/commanders'),
  ],
});
```

```bash
npx aomex openapi
# scaffold often: pnpm aomex openapi
```

On success you get the contract file in the working directory (or configured path).

The Console path is **batch file write**—it does not narrow `ctx` like Web routes. Business routes still narrow `action` at compile time; the export command reads the same route definitions + global `app` config to emit JSON.

::: warning
Align `saveToFile` with CI artifact paths or the pipeline cannot find the file and SDKs keep an old contract. After route or `app` mount / envelope changes, rerun `aomex openapi`—do not let the repo contract drift.
:::

## routers and app

Export does not listen on HTTP, but generation needs the **same** route directory as production and the same `WebApp` (auth, `formatError`, envelope). `routers` glob matches Web; omitting `app` makes security, error bodies, and wrapper shape diverge from real responses.

| Option | When to use | Default |
| --- | --- | --- |
| `routers` | Required; same glob as Web | — |
| `app` | Same `WebApp` instance as production | — |
| `docs` | `info.title` / `version` / `description` | — |
| `fix` | Patch `servers`, contacts, doc-level fields | — |
| `saveToFile` | Output path; CI archive | `openapi.json` |

CI archive example:

```typescript
import { app } from './app.js';

openapi({
  routers: './src/routers',
  app,
  saveToFile: 'artifacts/openapi.json', // [!code highlight]
  docs: {
    info: { title: 'My API', version: '1.0.0' },
  },
  fix: (doc) => {
    doc.servers = [{ url: 'https://api.example.com' }];
    return;
  },
});
```

## Export vs runtime JSON

| Scenario | Approach |
| --- | --- |
| CI archives contract each build | This page: `openapi()` + `aomex openapi` |
| Refresh file after local route edits | Same, run manually |
| Serve latest JSON per request at runtime | Web route calling `generateOpenapi({ routers, app })`—skip Console |

Hand the file to [Swagger UI](/en/plugins/swagger-ui) / [Redoc UI](/en/plugins/redoc-ui), or commit for contract tests.

Export is not the same as dynamic `/openapi.json` at runtime—online rescans cost CPU; production doc sites usually export + static file or UI plugin.

## Related

- [OpenAPI generation](/en/plugins/openapi)
- [Response envelope](/en/web/envelope)
- [Swagger UI](/en/plugins/swagger-ui)
- [Redoc UI](/en/plugins/redoc-ui)