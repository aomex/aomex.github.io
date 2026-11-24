---
outline: deep
---

# Quick install

Spin up a runnable aomex project from scratch: HTTP works and the terminal can run commands. The scaffold wires required pieces like logger, language, and shutdown so you are not assembling from nothing. The scaffold requires **Node.js `^22.22.2 || ^24.15.0 || >=26`**.

Whichever create command you use picks that package manager (override with `--pm`).

```bash
pnpm create aomex
yarn create aomex
npm create aomex
```

Follow the prompts for ORM, auth, middleware, and so on; then enter the project and start:

```bash
cd <project>
pnpm start   # or yarn start / npm start
```

The generated project root includes `AGENTS.md` → `aomex-skill.md` so AI assistants can extend the code by convention.

After it starts, hit the health check or home page in the browser (port from template `PORT`). On the terminal side:

```bash
pnpm aomex -h
```

## Non-interactive flags

Every option can be passed as a CLI flag to skip prompts (handy for scripts / CI). Anything you omit is still asked interactively.

| Flag | Meaning | Example |
| --- | --- | --- |
| `--project` | Project directory name | `--project=my-api` |
| `--node` | Node version (omit to pick LTS interactively, ≥24) | `--node=24.22.0` |
| `--pm` | Package manager (defaults to the create command’s) | `--pm=pnpm` \| `yarn` \| `npm` |
| `--orm` | ORM | `--orm=prisma` \| `mongoose` \| `none` |
| `--db` | Prisma database (only with `--orm=prisma`) | `--db=mysql` \| `postgresql` \| … |
| `--auth` | Auth strategies, comma-separated; `none` for none | `--auth=bearer,jwt` \| `--auth=none` |
| `--web-plugins` | Optional Web middleware (`cors` / `etag` / `helmet` / `response-time` are always installed) | `--web-plugins=http-access-log,async-trace` |
| `--docs` | Docs UI | `--docs=swagger` \| `redoc` \| `scalar` \| `none` |
| `--logger` | Log transports, comma-separated | `--logger=console,file` |
| `--console-middlewares` | Console plugins; `cron` is always installed, you can add more | `--console-middlewares=openapi` |
| `--lang` | Default language (BCP 47) | `--lang=en-US` |
| `--docker` | Whether to generate Docker production artifacts | `--docker=true` \| `false` |
| `--tz` / `--timezone` | Process timezone | `--tz=Asia/Shanghai` |
| `--cluster` | Cluster plan (do not stack) | `--cluster=none` \| `cluster-listen` \| `pm2` |

```bash
pnpm create aomex -- \
  --project=HelloAomex \
  --pm=pnpm \
  --orm=prisma \
  --db=mysql \
  --auth=bearer \
  --docs=swagger \
  --lang=en-US \
  --docker=true \
  --tz=Asia/Shanghai \
  --web-plugins=http-access-log,async-trace \
  --logger=console,file \
  --cluster=none
```

## Directory layout

The scaffold looks roughly like this (versions may tweak details). Hold onto three lines: `src/web.ts` starts HTTP, `src/cli.ts` starts the terminal / Cron / OpenAPI dump, and `src/routers/` / `src/commanders/` hold APIs and commands; reusable middleware (auth, error format, access log) goes in `src/middleware/`, DB and cache in `src/services/`—**shared by both sides**.

| File / directory | What you change it for |
| --- | --- |
| `src/web.ts` | Start HTTP |
| `src/cli.ts` | Start CLI commands / Cron / dump OpenAPI |
| `src/routers/` | Write APIs |
| `src/commanders/` | Write CLI commands |
| `src/middleware/` | Auth, formatError, access log, Swagger, and other reusable middleware—then mount on `web.ts` / route mount |
| `src/services/` | DB, cache, email—keep business SQL out of route `action`s |
| `src/schemas/` | Reusable validation, named `xxx.schema.ts` (same files for OpenAPI and CLI) |

Delete what you do not need (prisma, i18n, …)—no need to keep empty shells. CORS, auth, OpenAPI, and similar are separate packages; install when you use them.

## Try changing an API

The scaffold already has `src/routers/`. New files `export const router = new Router()`; `routers('./src/routers')` picks them up. Validate before the action:

```typescript
// src/routers/hello.router.ts
import { rule } from '@aomex/common';
import { query, Router } from '@aomex/web';

export const router = new Router();

router.get('/hello', {
  mount: [
    query({ name: rule.string().default('world') }), // [!code highlight]
  ],
  action: async (ctx) => {
    ctx.send({ message: `hello, ${ctx.query.name}` });
  },
});
```

After `pnpm start`, hit `/hello?name=ada`—`ctx.query.name` is already a string.

## Try running a command

Console and Web **share** services / schemas. Edit commands under `src/commanders/`, or run what the scaffold ships:

```bash
pnpm aomex hello
pnpm aomex hello --user Ada
```

Cron and OpenAPI dumps also go through `src/cli.ts`—see [Cron](/en/plugins/cron) · [Generate OpenAPI](/en/openapi/).

## Next steps

1. [Web app entry](/en/web/) — WebApp required options, language, shutdown  
2. [API routing](/en/web/router) — mount, docs, disabled  
3. [Validators](/en/validators/) — how fields are checked and types narrowed  
4. [Services](/en/core/service) — where DB and cache live  
5. [Console app entry](/en/console/) — commands and Cron
