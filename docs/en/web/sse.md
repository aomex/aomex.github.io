---
outline: deep
---

# Server-sent events (SSE)

Build a GET endpoint that **pushes continuously** while the browser listens with `EventSource`: call `ctx.sse()` in the action and emit via `stream` or `send`. Good for notifications, progress, ticker refresh—use WebSocket when you need messy bidirectional frames.

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

Prefer `stream`: when the client disconnects `signal` aborts and the iterator cleans up—less manual `close` / timer clearing.

`ctx.sse()` equals `ctx.response.sse()`; call **before** response headers are sent or it throws. SSE owns the response—do not `ctx.send` JSON on the same route after opening. Opens as 200 with `Content-Type: text/event-stream`. Object `data` in `emit` / `send` is JSON-serialized; `lastEventId` comes from the request header—often `undefined` on first connect.

## heartbeat and retry

Long browser connections get killed as idle by proxies. **heartbeat** sends comment lines periodically; **retry** tells the client how long to wait before reconnecting (set when opening the stream). Disable heartbeat for short local tests; production through Nginx/CDN should tune both.

```typescript
const sse = ctx.sse({
  heartbeat: 10_000,
  retry: 3_000,
});
```

| Option | Default / habit | When to use |
| --- | --- | --- |
| `heartbeat` | often ~15s | Keep-alive through Nginx/CDN; local short test `heartbeat: false` |
| `retry` | unset | Browser reconnect delay in ms (notifications often `3000`) |

## Per-event fields

Each `send` / `emit` may set `event` name, `id`, optional per-event `retry`, and `data`. Object `data` auto JSON-serializes; stable **id** lets reconnect send `Last-Event-ID` for resume.

| Field | When to use |
| --- | --- |
| `data` | Payload; objects → JSON |
| `event` | Multiple event types (`job` / `progress` / `ready`); frontend listens by name |
| `id` | Resume after disconnect; reconnect carries `Last-Event-ID` |
| `retry` | Per-event reconnect interval override |

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

`stream` wraps “read upstream, emit along the way”: client disconnect aborts **signal** and ends the iterator—no hand-rolled timers/`close`. Use `lastEventId` to continue after an id; release subscriptions in `onClose`.

```typescript
await sse.stream(async (emit, signal) => {
  // emit same as sse.send; signal aborts on disconnect
});
```

| Member | Typical use |
| --- | --- |
| `lastEventId` | Push events after this id |
| `signal` | Pass to Redis subscribe, queue watch—stop upstream when client leaves |
| `onClose(fn)` | Unsubscribe, audit log |
| `close()` | End job and close stream; `stream` end calls it automatically |

```typescript
const after = sse.lastEventId; // [!code highlight]
sse.onClose(() => {
  subscription.unsubscribe();
});
sse.close();
```

`send` is ignored when the connection is closed or not writable—do not assume delivery. Set stable event ids for resume—or `lastEventId` mismatches and reconnect replays from the start.

::: warning
Through Nginx etc., besides framework `X-Accel-Buffering: no`, tune heartbeat and proxy buffering/timeouts or idle connections get cut.
:::

## With `response()` and OpenAPI

OpenAPI needs this GET exit as `text/event-stream`—mount `response({ contentType: 'text/event-stream', ... })`. That serves docs and types only—it does **not** replace `ctx.sse()` frames.

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

Compression middleware usually skips `text/event-stream`—see [Compress](/en/plugins/compress).

`EventSource` is GET-only; cross-origin with cookies needs [CORS](/en/plugins/cors).

## Next steps

- [Response constraints](/en/web/response) (stream `contentType`)
- [Web I/O overview](/en/web/) (mount with other middleware)
- [Compress](/en/plugins/compress) (do not break event streams)