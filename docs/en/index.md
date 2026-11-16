---
layout: home

hero:
  name: Aomex
  text: Type-safe Node.js framework
  tagline: One middleware stack for Web and Console. Route params, request bodies, and context flow into your handlers—with types you can infer, jump to, and autocomplete.
  actions:
    - theme: brand
      text: Get started
      link: /en/starting/installation
    - theme: alt
      text: GitHub
      link: https://github.com/aomex/aomex

features:
  - title: TypeScript end to end
    details: Types are not an afterthought—fields you add on ctx through middleware flow into actions from the moment you mount them.
  - title: One middleware, two runtimes
    details: Web HTTP and Console commands share the same onion model and composition. Write business logic once and mount it where you need it.
  - title: Validate input first
    details: Validators cover strings through ULID, files through Decimal. Only data that passes reaches your code, and types narrow accordingly.
  - title: Lazy-loaded services
    details: combineServices uses dynamic import plus Proxy—init on demand, methods always return Promises, onDestroy on shutdown.
  - title: Batteries-included ecosystem
    details: Auth, cache, logging, rate limits, compression, CORS, Cron, OpenAPI / Swagger / Redoc—install what you need.
  - title: Node ≥ 24
    details: Stays close to the runtime—built-in compression, stabler file and network APIs, less legacy baggage.
---