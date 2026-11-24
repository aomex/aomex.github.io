---
outline: deep
---

# Генерация AsyncAPI

OpenAPI описывает HTTP-интерфейсы; для realtime-канала — **AsyncAPI**. На Channel вы уже объявили входящую/исходящую форму через `payload()` / `emit()` — генератор сканирует эти объявления в документ AsyncAPI 3.x для фронта, интеграторов или просмотра в [AsyncAPI UI](/ru/asyncapi/asyncapi-ui).

События без payload / emit в документе дадут пустые куски. Сервис всё равно работает, но контракт неполный — на стыковке партнёр только гадает.

```bash
pnpm add @aomex/asyncapi-generator
```

## Сначала допишите контракт на Channel

Вход — `payload()`, выход — `emit()`. Рантайм-валидация, сужение типов и документ — один источник: правите в одном месте, меняется и там, и там.

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
      description: '房间内聊天消息',
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

## Генерация прямо из скрипта

`generateAsyncapi` принимает каталог Channel (или массив экземпляров). Версию `docs.asyncapi` задаёте сами (`3.0.0` или `3.1.0`) — генератор её не угадывает:

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

Поля вроде `servers`, до которых генератор не дотягивается, правьте Document в `fix`:

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

## Запись на диск через Console (для CI)

Тот же приём, что у OpenAPI: повесьте на `ConsoleApp`, в терминале одна команда. `commandName` по умолчанию `asyncapi`; `saveToFile` по умолчанию `asyncapi.json`, можно `.yaml` / `.yml` (формат по расширению).

```typescript
import { asyncapi } from '@aomex/asyncapi-generator';
import { commanders, ConsoleApp } from '@aomex/console';

const app = new ConsoleApp({
  services,
  logger: services.logger,
  language: 'zh-CN',
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

При запуске в терминале прокрутятся шаги (найти файлы → разобрать → сохранить → проверить). Из своего скрипта лучше вызывать `generateAsyncapi` выше — без spinner, удобнее ассертить.

## Дальше

- [AsyncAPI UI](/ru/asyncapi/asyncapi-ui) — листать документ в браузере
- [Исходящий emit](/ru/websocket/emit) / [Входящий payload](/ru/websocket/payload)
- [Маршрутизация событий](/ru/websocket/channel)
