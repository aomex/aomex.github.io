---
outline: deep
---

# AsyncAPI UI

Hang a human-readable page for realtime channels too, built on the official `@asyncapi/react-component`. You need an AsyncAPI document first: CI-written `asyncapi.json`, or generate on each request.

Want a quick look at the UI? [Official demo](https://asyncapi.github.io/asyncapi-react/). Where the contract comes from: [Generate AsyncAPI](/en/asyncapi/).

It is ordinary middleware on **WebApp** (not WebsocketApp)—the docs page itself is HTTP.

```bash
pnpm add @aomex/asyncapi-ui
```

## Read a file on disk (most common)

After CI has run `npx aomex asyncapi`, mount it. Open `/asyncapi` (or `/asyncapi/index.html`) in the browser; under the same prefix you can usually fetch the raw `asyncapi.json` too:

```typescript
import { asyncapiUI } from '@aomex/asyncapi-ui';

mount: [
  asyncapiUI({ asyncapi: './asyncapi.json' }), // [!code highlight]
  routers('./src/routers'),
],
```

`asyncapi` can also be a `.yaml` / `.yml` path.

## Generate on every request

When you do not want the contract file in the repo, pass a function that calls `generateAsyncapi`. Default `uriPrefix` is `/asyncapi`; set it when you need another path:

```typescript
import { asyncapiUI } from '@aomex/asyncapi-ui';
import { generateAsyncapi } from '@aomex/asyncapi-generator';

mount: [ // [!code focus:14]
  asyncapiUI({
    uriPrefix: '/asyncapi',
    asyncapi: async () => { // [!code highlight]
      return generateAsyncapi({
        channels: './src/channels',
        docs: {
          asyncapi: '3.1.0',
          info: { title: 'Realtime', version: '1.0.0' },
        },
      });
    },
  }),
  routers('./src/routers'),
],
```

## Do not leave it wide open in production

Default `/asyncapi` is easy to guess. Scaffold-style practice: add a random suffix, and on the public internet gate with `enable` (IP / login). The random string is **not** auth—it only raises the cost of being scanned. You can mount it alongside Swagger / Redoc as long as prefixes do not collide. Add `headTags` when you need a favicon in the docs page `<head>`.

```typescript
asyncapiUI({
  asyncapi: './asyncapi.json',
  uriPrefix: '/asyncapi-7c3e9a1f02b48d6e', // [!code highlight]
  enable: (ctx) => {
    return ctx?.request.ip === '127.0.0.1';
  },
});
```

## Next

- [Generate AsyncAPI](/en/asyncapi/)
- [WebSocket app entry](/en/websocket/)
- HTTP docs UI comparison: [Choosing a docs UI](/en/openapi/choose-ui)
