---
outline: deep
---

# Abuse protection

On realtime channels, probing often means sweeping event names that should not exist. `@aomex/abuse`’s `.socket()` does two things: check whether the IP is already blocked; use a `socket-events` strategy to count bait events and block the IP at the limit.

Block state is **shared** with HTTP (same `Abuse` instance, same `store`): an IP blocked by a Web honeypot is also refused on WebSocket. Handshake IP depends on `proxyIP` on the Web app—misconfigure it and you block the wrong people.

```bash
pnpm add @aomex/abuse
# also need existing @aomex/cache (and a Redis adapter in production)
```

## Mount an event-name honeypot first

`new Abuse(...)` gives you a service, not middleware you drop straight into mount. On WebSocket use **`abuse.socket()`**, ahead of `channels()`. If the HTTP app already has one instance, **reuse it**—do not `new` again. Memory locally; Redis adapter for multi-replica.

::: warning
You must have already `import '@aomex/websocket'` (registers `middleware.socket`) before calling.
:::

Put bait events in the `socket-events` strategy’s `events`: strings support `*`, or pass a regex (full-string match on `ctx.event`). Hits count per IP; at the limit the IP is blocked. `events` cannot be empty; creation validates that.

```typescript
import { Abuse } from '@aomex/abuse';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';

const abuse = new Abuse({
  store: new CacheMemoryAdapter(),
  strategies: [
    { // [!code focus:7]
      strategy: 'socket-events',
      events: ['admin.destroy', 'debug.*', /^internal\./],
      limit: 1,
      window: '1 hour',
      blockFor: '1 day',
    },
  ],
});

new WebsocketApp({
  logger: services.logger,
  language: { mode: 'fixed', language: 'en-US' },
  transport: new WsTransport(),
  mount: [
    abuse.socket(),
    channels('./src/channels'),
  ],
});
```

## What comes back when blocked

When the IP is already blocked, or a `socket-events` hit just fills the quota: push `{ event: 'error', data: { message } }`, then close with code **1008** (Policy Violation)—a ban is not soft rate-limiting, so the socket should not keep sitting open. `errorMessage` is both the error-frame copy and the close reason (transports may truncate long reasons). Allow lists are on `.socket()`—`bypass` returning `true` skips checks:

```typescript
mount: [
  abuse.socket({ // [!code focus:6]
    bypass: (ctx) => {
      return ctx.client.request.ip === '127.0.0.1';
    },
    errorMessage: 'Access restricted',
  }),
  channels('./src/channels'),
],
```

## Report from a Channel

If `ip-abuse` / `user-abuse` strategies are already configured when you construct `Abuse`, Channel actions can call the same APIs (e.g. when a user looks like spam). `ctx.client.request` exists from handshake—read the IP directly:

```typescript
channel.on('chat.send', {
  mount: [payload({ text: rule.string() })],
  action: async (ctx) => {
    if (looksLikeSpam(ctx.payload.text)) {
      await abuse.ipAbuse(ctx.client.request.ip, 'chat-spam');
    }
    // …
  },
});
```

How to declare strategies and APIs like `onBanUser` / `blockIP` matches the HTTP side; path honeypots and status tallies live under Web in [Abuse protection](/en/plugins/abuse).

## Next

- [Rate limiting](/en/websocket/rate-limit)
- [App entry](/en/websocket/)
- [Event channels](/en/websocket/channel)
