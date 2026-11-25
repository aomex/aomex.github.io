---
outline: deep
---

# Генерация AsyncAPI

OpenAPI описывает HTTP; для realtime-каналов — **AsyncAPI**. Если на Channel уже объявлены вход и выход через `payload()` / `emit()`, генератор собирает из этого документ AsyncAPI 3.x для фронта, партнёров или просмотра в [AsyncAPI UI](/ru/asyncapi/asyncapi-ui).

События без `payload` / `emit` дадут пустые секции в документе. Сервис работает, но контракт неполный — собеседнику остаётся угадывать.

```bash
pnpm add @aomex/asyncapi-generator
```

## Сначала полный контракт на Channel

Вход — `payload()`, выход — `emit()`. Рантайм-проверка и сужение типов из того же источника, что и документация — правите один раз, меняются оба.

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

## Прямая генерация в скрипте

`generateAsyncapi` принимает каталог Channel (или массив экземпляров). Версию `docs.asyncapi` задаёте сами (`3.0.0` или `3.1.0`) — генератор не угадывает:

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

Поля вроде `servers`, которые генератор не заполняет, правьте в `fix` на Document:

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

## Вывод через Console (для CI)

Тот же приём, что с OpenAPI: повесьте на `ConsoleApp`, одна команда в терминале. `commandName` по умолчанию `asyncapi`; `saveToFile` по умолчанию `asyncapi.json`, также `.yaml` / `.yml` (формат по расширению).

```typescript
import { asyncapi } from '@aomex/asyncapi-generator';
import { commanders, ConsoleApp } from '@aomex/console';
import { logger } from '@/services/logger.service';

const app = new ConsoleApp({
  services,
  logger,
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

В терминале пойдут шаги (поиск файлов → разбор → сохранение → проверка). В своих скриптах удобнее `generateAsyncapi` выше — без спиннера, проще assert.

## Дальше

- [AsyncAPI UI](/ru/asyncapi/asyncapi-ui) — просмотр документа в браузере
- [исходящий emit](/ru/websocket/emit) / [входящий payload](/ru/websocket/payload)
- [маршрутизация событий](/ru/websocket/channel)