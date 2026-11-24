---
outline: deep
---

# Access log

Realtime channels have no “URL + status code,” but you still want to know which IP, which connection, which event just ran, and how long it took. Use `websocketAccessLog()` from `@aomex/access-log/websocket`: one line after each inbound message finishes the middleware chain (including thrown errors).

```bash
pnpm add @aomex/access-log
```

## Start with every inbound message

Mount **before** `channels()`, or you will miss the line after business handling. Default format is `[ip] [clientId] [event] [duration]`, written to the console:

```typescript
import { websocketAccessLog } from '@aomex/access-log/websocket';
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';

new WebsocketApp({
  logger: services.logger,
  language: { mode: 'fixed', language: 'en-US' },
  transport: new WsTransport(),
  mount: [websocketAccessLog(), channels('./src/channels')], // [!code highlight]
});
```

## Change the format, add business fields

Tokens come from `WebsocketAccessLogToken`. `customTokens` receive the WebSocket ctx, so you can read business fields you previously stored on `client.data`. For disk output switch to `FileTransport`:

```typescript
import {
  WebsocketAccessLogToken,
  websocketAccessLog,
} from '@aomex/access-log/websocket';
import { FileTransport } from '@aomex/logger';

websocketAccessLog({ // [!code focus:14]
  format: [
    WebsocketAccessLogToken.event,
    WebsocketAccessLogToken.clientId,
    '[room]',
    WebsocketAccessLogToken.duration,
  ].join(' '),
  transports: [new FileTransport({ file: './logs/ws-access.log' })],
  customTokens: {
    room: (ctx) => {
      return String(ctx.client.data['room'] ?? '-');
    },
  },
});
```

Good for event mix and slow handlers—**not** the only audit for sensitive actions.

## Next

- [App entry](/en/websocket/)
- [Event channels](/en/websocket/channel)
- Levelled sinks: [Logger](/en/core/logger)
