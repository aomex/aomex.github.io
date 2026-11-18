---
outline: deep
---

# Choosing a docs UI

aomex ships three docs-page plugins: [Swagger UI](/en/openapi/swagger-ui), [Redoc UI](/en/openapi/redoc-ui), and [Scalar UI](/en/openapi/scalar-ui). They all read the **same** OpenAPI contract (exported `openapi.json` / yaml, or runtime `generateOpenapi`). What differs is **reading experience** and **whether you can try requests in the page**.

Use this page to pick by audience and scenario; install, mount, `uriPrefix` / `enable`, and the rest live on each UI page. How to produce the contract: [Generate OpenAPI](/en/openapi/).

## At a glance

| | [Swagger UI](/en/openapi/swagger-ui) | [Redoc UI](/en/openapi/redoc-ui) | [Scalar UI](/en/openapi/scalar-ui) |
| --- | --- | --- | --- |
| Default prefix | `/swagger` | `/redoc` | `/scalar` |
| In-page try-out | Yes (Try it out) | **No** | Yes |
| Reading feel | Console-like, dense fields | Left nav, long-form friendly | Modern layout; read + try |
| Typical readers | Devs, QA exercising APIs | Product, partners, handoff docs | People who both read and poke |
| Package | `@aomex/swagger-ui` | `@aomex/redoc-ui` | `@aomex/scalar-ui` |

All three are ordinary Web middleware: mount them and you get a page—they do **not** change business-route `ctx` types. With a site-wide [envelope](/en/web/envelope), docs pages `skipEnvelope` automatically so they are not wrapped.

## Pick by scenario

| What you are doing | Prefer | Why |
| --- | --- | --- |
| Local / internal: click and call APIs | Swagger or Scalar | Real requests in the browser; stick with Swagger if the team already knows Try it out, Scalar for a fresher UI |
| A “manual” URL for partners | Redoc | Calmer long-form and folded schemas; do not expect try-out |
| PDF / attachment-style API notes | Redoc | Better for scroll / print reading |
| Onboarding: read first, then try | Scalar, or Redoc + Swagger | One page for both, or split “read” and “try” links |
| Legacy team bookmarked Swagger | Keep Swagger | Lowest switching cost; add others later |
| Mixed audiences (product + eng) | **Coexist**, split `uriPrefix` | One contract, multiple UIs—see below |

Unsure? Ship **Scalar** or **Swagger** for day-to-day work; add **Redoc** when you need an outward-facing manual. There is no forced single choice—the contract source stays one.

## Boundaries (do not mix them up)

**In-page try-out** means filling params, attaching auth, and hitting the real (or gateway) service from the browser. Swagger and Scalar have it; Redoc does **not**.

```typescript
// Redoc only renders the contract—use Swagger / Scalar / Postman to call APIs
mount: [
  redocUI({ openapi: './openapi.json', uriPrefix: '/redoc-…' }),
  swaggerUI({ openapi: './openapi.json', uriPrefix: '/swagger-…' }),
  routers('./src/routers'),
],
```

::: warning
Do not hand QA / partners a Redoc URL as if it were “Swagger with Try it out.” The wrong link looks like a broken API when they cannot send requests.
:::

Other boundaries:

- Docs UI is **not** an auth scheme: public exposure hands over your API map (and try-out entry points when available).
- Defaults `/swagger`, `/redoc`, `/scalar` are easy to guess—prefer a **random** `uriPrefix`, plus `enable` / internal network / gateway; details on each UI page.
- Dynamic `openapi: () => generateOpenapi(...)` must pass the same live `app`, or security / envelope drift from production.

## Coexist on one app

Any two or all three can mount on the same `WebApp`. **Prefixes must differ**; the contract file can be shared:

```typescript
import { swaggerUI } from '@aomex/swagger-ui';
import { redocUI } from '@aomex/redoc-ui';
import { scalarUI } from '@aomex/scalar-ui';

mount: [ // [!code focus:13]
  swaggerUI({
    openapi: './openapi.json',
    uriPrefix: '/swagger-7c3e9a1f02b48d6e',
  }),
  redocUI({
    openapi: './openapi.json',
    uriPrefix: '/redoc-a1b2c3d4e5f60718',
  }),
  scalarUI({
    openapi: './openapi.json',
    uriPrefix: '/scalar-9f8e7d6c5b4a3210',
  }),
  routers('./src/routers'),
],
```

When production is internal-only or gated by IP / token, reuse the same `enable` logic for every UI so you do not leave one open.

## Working with contract generation

| Contract source | How UIs usually read it |
| --- | --- |
| CI `aomex openapi` export | All three: `openapi: './openapi.json'` (or yaml)—re-export after route changes |
| Runtime `generateOpenapi` | `openapi: () => generateOpenapi({ routers, app })`—no file, same `app` |
| Static site for partners only | Often Redoc + exported file; keep try-out internal |

Scanning every route on each docs hit burns CPU: public production pages usually use **exported files + UI**; dynamic generation is handy in development. Full export flow: [Generate OpenAPI](/en/openapi/).

## Quick checklist

| Question | Answer |
| --- | --- |
| One UI, need try-out | Scalar or Swagger |
| One UI, readable manual only | Redoc |
| Product reads, eng tries | Redoc + (Swagger or Scalar) |
| Team already lives in Swagger | Keep it; add Redoc / Scalar |
| Worried about public scanners | Random `uriPrefix` + `enable` on every UI |

Install and wire-up:

- [Swagger UI](/en/openapi/swagger-ui)
- [Redoc UI](/en/openapi/redoc-ui)
- [Scalar UI](/en/openapi/scalar-ui)

## Related

- [Generate OpenAPI](/en/openapi/)
- [Tags](/en/openapi/tags) · [Markdown copy](/en/openapi/markdown)
- [Swagger UI](/en/openapi/swagger-ui) · [Redoc UI](/en/openapi/redoc-ui) · [Scalar UI](/en/openapi/scalar-ui)
