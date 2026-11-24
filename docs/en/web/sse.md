---
outline: deep
---

# Server-Sent Events (SSE)

Build a GET endpoint where the server keeps pushing and the browser listens with EventSource: call `ctx.sse()` in the action, then push events with `stream` or `send`. Fits notifications, progress bars, and live quotes; for messy bidirectional frames, consider WebSocket.

```typescript
import { Router } from '@aomex/web';

export const router = new Router();

router.get('/events', { // [!code focus:13]
  action: async (ctx) => {
    const sse = ctx.sse({ retry: 3_000 }); // [!code highlight]
    await sse.stream(async (emit, signal) => {
      for await (const item of watchEvents({
        after: sse.lastEventId,
        signal,
      })) {
        emit({ id: String(item.id), event: 'item', data: item });
      }
    });
  },
});
```

Prefer `stream`: when the client disconnects, `signal` aborts; when the iteration ends, cleanup runs automatically—fewer manual closes and timer teardowns.

`ctx.sse()` and `ctx.response.sse()` are equivalent; call them **before response headers are written**, or they throw. SSE owns the whole response—do not `ctx.send` JSON at the end of the same route. After open, status is 200 and Content-Type is `text/event-stream`. Object `data` on emit / send is JSON-serialized; `lastEventId` comes from the request header and is usually `undefined` on the first connection.

## heartbeat and retry

Long browser connections are often treated as idle by reverse proxies and cut. `heartbeat` periodically pushes comment lines to keep alive (often about 15s; local short tests can use `heartbeat: false`). `retry` suggests how many milliseconds the client should wait before reconnecting (notification streams often use `3000`). Production streams through Nginx or a CDN need both checked.

```typescript
const sse = ctx.sse({
  heartbeat: 10_000,
  retry: 3_000,
});
```

## Per-event fields

Each `send` / `emit` can carry an event name, id, optional per-event retry, and a data payload. Object data is JSON-serialized automatically; with an **id**, the browser reconnects with `Last-Event-ID` so you can resume. When several event types coexist (`job` / `progress` / `ready`), the frontend listens by `event` name.

```typescript
sse.send({ data: { hello: 'world' } });
sse.send({ event: 'ready' });
sse.send({
  id: '42', // [!code highlight]
  event: 'job',
  retry: 5_000,
  data: 1,
});
```

## stream, resume, and cleanup

`stream` wraps “read upstream while emitting” into one lifecycle: client disconnect aborts **signal** (pass it to Redis subscriptions or queue watchers); when iteration ends, cleanup runs so you skip hand-written timers and close. `lastEventId` comes from the request header—use it to resume after a given event; release subscriptions and record audits in `onClose`; you can also `close()` when a job finishes (`stream` calls it automatically when done).

```typescript
await sse.stream(async (emit, signal) => { // [!code focus:8]
  const after = sse.lastEventId;
  sse.onClose(() => {
    subscription.unsubscribe();
  });
  for await (const item of watchEvents({ after, signal })) {
    emit({ id: String(item.id), event: 'item', data: item });
  }
});
```


When the connection is closed or not writable, `send` silently ignores—do not treat that as “definitely delivered”. For resume-after-disconnect, give events stable ids; otherwise `lastEventId` will not match and reconnects start from scratch.

::: warning
Long connections through Nginx and similar proxies need heartbeat and proxy buffer timeouts aligned—beyond the framework’s `X-Accel-Buffering: no`—or idle cuts are common.
:::

## With response() and OpenAPI

OpenAPI needs to know this GET exit is `text/event-stream`, so mount `response({ contentType: 'text/event-stream', ... })`. That only serves docs and types—it **does not replace** writing frames with `ctx.sse()` in the action.

```typescript
import { rule } from '@aomex/common';
import { response } from '@aomex/web';

response({
  statusCode: 200,
  contentType: 'text/event-stream', // [!code highlight]
  content: rule.string(),
  description: 'SSE event stream',
});
```

This only helps docs and type hints—it **cannot replace** the frame protocol of `ctx.sse()`. Compression middleware usually skips `text/event-stream`; see [Compress](/en/plugins/compress).

EventSource is GET-only; cross-site cookies need [CORS](/en/plugins/cors) configured.

## Next steps

- [Constrain response](/en/web/response) (declare `contentType` for streaming exits)
- [I/O overview](/en/web/) (mount with other Web middleware)
- [Compress](/en/plugins/compress) (do not crush the event stream)
