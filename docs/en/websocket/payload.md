---
outline: deep
---

# Inbound payload

The `data` clients send with an event is untrusted by default. Mount `payload()` on the event’s mount and declare fields with the [validators](/en/validators/) you already know; after it passes, use `ctx.payload` with narrowed types. On failure the framework pushes `{ event: 'error', data: { message } }` to **this** connection and **does not** enter `action`—same idea as HTTP body validation returning 400 without running the route.

Start with a chat inbound:

```typescript
import { Channel, payload } from '@aomex/websocket';
import { rule } from '@aomex/common';

export const channel = new Channel();

channel.on('chat.send', { // [!code focus:16]
  mount: [
    payload({ // [!code highlight]
      roomId: rule.string(),
      text: rule.string().max(2000),
    }),
  ],
  action: async (ctx) => {
    // here ctx.payload.roomId / text are already string
    await ctx.room(ctx.payload.roomId).send(
      'chat.message',
      { from: ctx.client.id, text: ctx.payload.text },
      { except: ctx.client },
    );
  },
});
```

Clients still send the agreed shape:

```typescript
socket.send(
  JSON.stringify({
    event: 'chat.send',
    data: { roomId: 'lobby', text: 'hello' },
  }),
);
```

When `text` is too long or `roomId` is missing, `onmessage` sees `event === 'error'` and the business action never runs. Do not re-hand-check `if (typeof raw.text !== 'string')` in action—it drifts from validation, error copy, and later AsyncAPI.

::: tip
Without `payload()`, `ctx.payload` is typed `unknown` and may never be assigned at runtime. For quick debugging you can read `ctx.rawPayload` (raw `data` from the frame); real interfaces should mount `payload()`.
:::

## Share a field set across events

If every event may carry an optional `token`, hang it on the Channel constructor; each event adds its own `payload()` for business fields. Later same-name fields override earlier ones in the type.

```typescript
export const channel = new Channel({
  mount: [
    payload({
      token: rule.string().optional(),
    }),
  ],
});

channel.on('chat.send', { // [!code focus:12]
  mount: [
    payload({
      text: rule.string().max(2000),
    }),
  ],
  action: async (ctx) => {
    ctx.payload.token; // string | undefined
    ctx.payload.text; // string
  },
});
```

Input shapes match `body()` / `query()`: field tables, `rule.object()`, scalars, `schema(...)` all work. When generating [AsyncAPI](/en/asyncapi/), these declarations become inbound messages; skip the mount and that section of the doc is empty while runtime can still muddle through with `rawPayload`—easy to miss a broken contract during integration.

::: tip
Business errors like rate-limit trips or auth failures also conventionally push `event: 'error'` (or a dedicated event you declare in [emit](/en/websocket/emit)). Frontends listen to a small set of outbound events and stay simpler.
:::

## Next

- [Outbound emit](/en/websocket/emit)
- [Event channels](/en/websocket/channel)
- [Validators quick start](/en/validators/)
