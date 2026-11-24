---
outline: deep
---

# Outbound emit

HTTP uses `response()` to declare “what this route returns”; WebSocket’s counterpart is `emit()`: declare **which outbound event names and payload shapes this handler is allowed to `send`**.

At runtime it does almost nothing (it will not stop a mistyped object). The real wins are two:

1. TypeScript narrows `ctx.send` / `ctx.room().send` / `ctx.all.send`—wrong event names or missing fields light up in the editor.
2. When generating [AsyncAPI](/en/asyncapi/), outbound messages come from here.

Hang outbound contracts next to the chat inbound: one room message, one send ack. Omit `data` when there is no payload; `description` is docs-only and does not affect runtime.

```typescript
import { Channel, emit, payload } from '@aomex/websocket';
import { rule } from '@aomex/common';

export const channel = new Channel();

channel.on('chat.send', { // [!code focus:24]
  mount: [
    payload({
      roomId: rule.string(),
      text: rule.string().max(2000),
    }),
    emit({ // [!code highlight]
      event: 'chat.message',
      description: 'Chat message in the room',
      data: {
        from: rule.string(),
        text: rule.string(),
      },
    }),
    emit({ event: 'chat.ack', description: 'Send acknowledgement' }),
  ],
  action: async (ctx) => {
    await ctx.room(ctx.payload.roomId).send(
      'chat.message',
      { from: ctx.client.id, text: ctx.payload.text },
      { except: ctx.client },
    );
    await ctx.send('chat.ack');
  },
});
```

You can mount many `emit()` calls; contracts merge into one table.

::: warning
`emit()` does **not** validate objects you pass to `send` at runtime. Types come from TS; docs come from the generator reading hooks. Skip `emit` and `send` becomes “any event name again,” and AsyncAPI will not show that outbound message.
:::

`await ws.room(...).send('order.updated', order)` from a route does **not** automatically pick up `emit` types from some Channel—that is a different call surface. Keep push bodies aligned with docs by assembling from the same schema (or a hand-written object of the same shape).

## Next

- [Inbound payload](/en/websocket/payload)
- [Generate AsyncAPI](/en/asyncapi/) — scan payload / emit into docs
- [Event channels](/en/websocket/channel)
