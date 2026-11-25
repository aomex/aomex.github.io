---
outline: deep
---

# Rate limiting

Someone stays connected and hammers `send`—WebSocket limits **each inbound message** (not connection count). Use `websocketRateLimit()` from `@aomex/rate-limit/websocket`: mount **before** `channels()`; over limit pushes `{ event: 'error', … }`, **skips** business handlers, and keeps the connection open (no disconnect that would trigger immediate reconnect spam).

```bash
pnpm add @aomex/rate-limit
# Shared counts across replicas:
pnpm add @aomex/rate-limit-redis-store
```

## Blunt spam first

Window via `window` (milliseconds or readable durations like `'10s'` / `'1 minute'`), count via `limit`. Default identity is `ctx.client.request.ip`—multiple connections from one IP share the quota. `ctx.client.request` exists from handshake, so it is never empty:

```typescript
import { websocketRateLimit } from '@aomex/rate-limit/websocket';
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';
import { logger } from '@/services/logger.service';

new WebsocketApp({
  logger,
  language: { mode: 'fixed', language: 'en-US' },
  transport: new WsTransport(),
  mount: [ // [!code focus:6]
    websocketRateLimit({
      limit: 30,
      window: '10s', // [!code highlight]
    }),
    channels('./src/channels'),
  ],
});
```

Defaults without options are 1 hour / 2500—loose for most chat; “30 in 10 seconds” is better against spam bots.

## Count by logged-in user, allow lists

To count by user, write your own `id`; return `false` to skip this message. Intranet debugging can use `allowList` to skip; banned accounts can use `denyList` to reject outright. Override the over-limit copy with `errorMessage` (default is the i18n “too many requests” string):

```typescript
websocketRateLimit({ // [!code focus:18]
  limit: 60,
  window: '1 minute',
  id: (ctx) => {
    const userId = ctx.client.data['userId'];
    if (typeof userId === 'string') {
      return userId;
    }
    return ctx.client.request.ip;
  },
  allowList: (ctx) => {
    return ctx.client.request.ip === '127.0.0.1';
  },
  denyList: (ctx) => {
    return ctx.client.data['banned'] === true;
  },
  errorMessage: 'Sending too fast, try again later',
});
```

## Multi-replica: Redis

Same `RateLimitRedisStore` as HTTP. Even if you reuse one store instance, key prefixes differ (`aomex-rate-limit:ws:…`), so quotas do not eat each other. Real IP depends on `proxyIP` on the Web app (handshake uses the same chain).

```typescript
import { RateLimitRedisStore } from '@aomex/rate-limit-redis-store';

websocketRateLimit({ // [!code focus:8]
  store: new RateLimitRedisStore({
    host: '127.0.0.1',
    port: 6379,
  }),
  limit: 30,
  window: '10s',
});
```

## Next

- [Abuse protection](/en/websocket/abuse)
- [App entry](/en/websocket/)
- [Event channels](/en/websocket/channel)
