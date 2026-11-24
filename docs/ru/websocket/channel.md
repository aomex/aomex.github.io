---
outline: deep
---

# Маршрутизация событий Channel

В Web интерфейсы различают по «пути»; в WebSocket — по «имени события». В `src/channels` вы раскладываете файлы по бизнесу, каждый экспортирует `Channel`, регистрирует обработчик через `channel.on('имя-события', { ... })`, а на входе приложения одним вызовом вешает `channels('./src/channels')` — та же привычка, что `routers('./src/routers')`.

Сразу разведите термин: **Channel — это не комната**. Channel только группирует код в файле; «лобби / номер заказа» — это `join` / `room(...).send`. В одном файле Channel можно обрабатывать несколько событий и входить в несколько комнат.

## Как клиент шлёт и как сервер принимает

Для стандартного WebSocket (`WsTransport`) одна рамка — JSON:

```json
{ "event": "chat.send", "data": { "roomId": "lobby", "text": "hi" } }
```

`event` должен **буква в букву** совпадать со строкой в `channel.on`; `data` — полезная нагрузка, её валидирует `payload()` на следующей странице. Если транспорт Socket.IO, в браузере это `socket.emit('chat.send', { ... })`, имя события по-прежнему соответствует `channel.on`.

## Первый Channel, который отвечает pong

Начните с `ping`, затем «войти в комнату» и «отправить чат» — после сохранения переподключитесь и проверьте:

```typescript
// src/channels/chat.channel.ts
import { Channel, payload } from '@aomex/websocket';
import { rule } from '@aomex/common';

export const channel = new Channel();

channel.on('ping', {
  action: async (ctx) => {
    await ctx.send('pong', { at: Date.now() });
  },
});

channel.on('room.join', { // [!code focus:7]
  mount: [payload({ roomId: rule.string() })],
  action: async (ctx) => {
    await ctx.client.join(ctx.payload.roomId);
    await ctx.room(ctx.payload.roomId).send('room.joined', { id: ctx.client.id });
  },
});

channel.on('chat.send', {
  mount: [
    payload({
      roomId: rule.string(),
      text: rule.string().max(2000),
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

Если на входе уже висит `channels('./src/channels')`, в браузере так:

```typescript
const socket = new WebSocket('ws://localhost:3000/ws');
socket.onopen = () => {
  socket.send(JSON.stringify({ event: 'ping', data: {} }));
  socket.send(
    JSON.stringify({ event: 'room.join', data: { roomId: 'lobby' } }),
  );
};
socket.onmessage = (ev) => {
  console.log(JSON.parse(String(ev.data)));
};
```

В тестах или без сканирования каталога можно передать экземпляры напрямую:

```typescript
mount: [channels([chatChannel, orderChannel])],
```

::: warning
Одно и то же имя события нельзя зарегистрировать дважды — ни в одном файле, ни между файлами. При загрузке сразу будет ошибка, чтобы не казалось, что «оба handler висят», а реально работает один.
:::

Если имя события от клиента никто не заявил, вызов уйдёт наружу через `next()`; по умолчанию его тихо отбрасывают. На входе можно поставить `unknownEvent: 'error'` — при стыковке так нагляднее.

## ctx внутри action

Думайте о ctx как о «рабочем столе этой входящей рамки». Сразу после соединения фреймворк уже ввёл его в комнату с именем `client.id`, поэтому снаружи можно делать point-to-point через `ws.room(какой-то-id).send(...)`. При обрыве клиент сам покидает все комнаты — руками чистить обычно не нужно.

Частые приёмы:

| Что нужно | Как писать |
| --- | --- |
| Имя события | `ctx.event` |
| Сырой data (ещё без валидации) | `ctx.rawPayload` |
| Данные после валидации | `ctx.payload` (сначала повесьте `payload()`) |
| Ответ только этому соединению | `ctx.send(...)` или `ctx.client.send(...)` |
| Войти / выйти из комнаты | `ctx.client.join(name)` / `leave(name)` |
| Пуш в комнату | `ctx.room(name).send(...)` (по умолчанию **включая себя**) |
| Пуш всем онлайн | `ctx.all.send(...)` |
| Закрыть текущее соединение | `ctx.client.close(code, reason)` |

Broadcast в комнату по умолчанию доходит и до вас. В чате, чтобы не получать своё же сообщение, добавьте `{ except: ctx.client }`:

```typescript
await ctx.room('lobby').send(
  'chat.message',
  { from: ctx.client.id, text: ctx.payload.text },
  { except: ctx.client }, // [!code highlight]
);
```

## Немного бизнес-данных на соединении

`ctx.client.data` — обычный объект, живущий с этим соединением: после логина положите `userId`, следующие события читают его напрямую. Тип по умолчанию — `Record<string, unknown>`; при необходимости расширьте модуль:

```typescript
channel.on('auth.ok', {
  mount: [payload({ userId: rule.string() })],
  action: async (ctx) => {
    ctx.client.data['userId'] = ctx.payload.userId; // [!code highlight]
    await ctx.send('auth.ok', { ok: true });
  },
});
```

```typescript
declare module '@aomex/websocket' {
  namespace WebsocketContext {
    interface Props {
      userId: string;
    }
  }
}
```

## Общий mount на весь файл

Всем событиям Channel нужна авторизация? Задайте `new Channel({ mount })` — меньше копипасты в каждом `on`. У события свой `mount` всё равно может добавить `payload()` и т.п. только для этой ветки.

```typescript
export const channel = new Channel({
  mount: [requireLogin()], // [!code highlight]
});

channel.on('chat.send', {
  mount: [payload({ text: rule.string().max(2000) })],
  action: async (ctx) => {
    await ctx.room('lobby').send('chat.message', {
      from: ctx.client.id,
      text: ctx.payload.text,
    });
  },
});
```

Временно отключить отладочное событие — `disabled`; в production оно просто не регистрируется:

```typescript
channel.on('debug.dump', {
  disabled: process.env.NODE_ENV === 'production',
  action: async (ctx) => {
    await ctx.send('debug.dump', ctx.client.data);
  },
});
```

## Дальше

- [Входящий payload](/ru/websocket/payload) — больше не делайте `as` на data вручную
- [Исходящий emit](/ru/websocket/emit) — сузить типы `send` и попасть в AsyncAPI
- [Точка входа](/ru/websocket/) — пуш в комнаты из HTTP-маршрута
