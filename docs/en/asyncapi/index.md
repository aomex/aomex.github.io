---
outline: deep
---

# Generate AsyncAPI

OpenAPI describes HTTP APIs; realtime channels use **AsyncAPI**. You already declare shapes with `payload()` / `emit()` on Channels—the generator scans those into an AsyncAPI 3.x document for frontends, partners, or [AsyncAPI UI](/en/asyncapi/asyncapi-ui).

Events without payload / emit leave empty sections in the doc. The service still runs; the contract is just incomplete, and integrators have to guess.

```bash
pnpm add @aomex/asyncapi-generator
```

## Declare the full contract on Channels first

Inbound via `payload()`, outbound via `emit()`. Runtime validation, type narrowing, and docs share one source—change once, both sides move.

```typescript
// src/channels/chat.channel.ts
import { Channel, emit, payload } from '@aomex/websocket';
import { rule } from '@aomex/common';

export const channel = new Channel();

channel.on('chat.send', { // [!code focus:18]
  mount: [
    payload({
      roomId: rule.string(),
      text: rule.string().max(2000),
    }),
    emit({
      event: 'chat.message',
      description: 'Chat message in the room',
      data: {
        from: rule.string(),
        text: rule.string(),
      },
    }),
  ],
  action: async (ctx) => {
    await ctx.room(ctx.payload.roomId).send(
      'chat.message',
      { from: ctx.client.id, text: ctx.payload.text },
      { except: ctx.client },
    );
  },
});
```

## Generate from a script

`generateAsyncapi` takes a Channel directory (or instance array). You must set `docs.asyncapi` yourself (`3.0.0` or `3.1.0`)—the generator will not guess:

```typescript
import { writeFile } from 'node:fs/promises';
import { generateAsyncapi } from '@aomex/asyncapi-generator';

const document = await generateAsyncapi({ // [!code focus:8]
  channels: './src/channels',
  docs: {
    asyncapi: '3.1.0',
    info: { title: 'Realtime', version: '1.0.0' },
  },
});

await writeFile('asyncapi.json', JSON.stringify(document, null, 2));
```

To fill fields the generator does not own (e.g. `servers`), mutate the Document in `fix`:

```typescript
await generateAsyncapi({
  channels: './src/channels',
  docs: {
    asyncapi: '3.1.0',
    info: { title: 'Realtime', version: '1.0.0' },
  },
  fix: (data) => { // [!code focus:9]
    data.servers = {
      production: {
        host: 'api.example.com',
        pathname: '/ws',
        protocol: 'wss',
      },
    };
  },
});
```

## Write to disk from Console (for CI)

Same pattern as OpenAPI: mount on `ConsoleApp`, run one terminal command. Default `commandName` is `asyncapi`; default `saveToFile` is `asyncapi.json`—or use `.yaml` / `.yml` (format follows the extension).

```typescript
import { asyncapi } from '@aomex/asyncapi-generator';
import { commanders, ConsoleApp } from '@aomex/console';

const app = new ConsoleApp({
  services,
  logger: services.logger,
  language: 'en-US',
  mount: [ // [!code focus:12]
    asyncapi({
      commandName: 'asyncapi',
      channels: './src/channels',
      docs: {
        asyncapi: '3.1.0',
        info: { title: 'Realtime', version: '1.0.0' },
      },
      saveToFile: 'asyncapi.json',
    }),
    commanders('./src/commanders'),
  ],
});
```

```bash
npx aomex asyncapi
```

The terminal spins through a few steps (find files → parse → save → validate). Prefer `generateAsyncapi` above when calling from your own scripts—no spinner, easier assertions.

## Next

- [AsyncAPI UI](/en/asyncapi/asyncapi-ui) — browse the document in a browser
- [Outbound emit](/en/websocket/emit) / [Inbound payload](/en/websocket/payload)
- [Event channels](/en/websocket/channel)
