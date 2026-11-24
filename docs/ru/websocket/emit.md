---
outline: deep
---

# Исходящий emit

В HTTP «какой ответ отдаёт этот интерфейс» объявляют через `response()`; в WebSocket аналог — `emit()`: вы говорите, **какие имена событий и какой формы payload разрешены для `send` в этом обработчике**.

В рантайме он почти ничего не делает (не остановит «левый» объект). Реальная польза две:

1. TypeScript сужает `ctx.send` / `ctx.room().send` / `ctx.all.send` — опечатка в имени события или пропущенное поле сразу красным в редакторе.
2. При генерации [AsyncAPI](/ru/asyncapi/) исходящие message берутся отсюда.

Рядом с входящим чатом повесьте исходящий контракт: сообщение в комнату и ack отправки. Если payload не нужен — опустите `data`; `description` только в документ, на рантайм не влияет.

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
      description: '房间内聊天消息',
      data: {
        from: rule.string(),
        text: rule.string(),
      },
    }),
    emit({ event: 'chat.ack', description: '发送确认' }),
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

Можно повесить много `emit()` — контракты сольются в одну таблицу.

::: warning
`emit()` **не** проверяет в рантайме объект, который вы передаёте в `send`. Типы — за TS; документ — за генератором, который читает хуки. Без `emit` `send` снова принимает «любое имя события», и в AsyncAPI этой исходящей ветки не будет.
:::

Вызов `await ws.room(...).send('order.updated', order)` из маршрута **не** подхватывает типы `emit` из какого-то Channel — это другая поверхность вызова. Чтобы тело пуша совпадало с документом, собирайте объект по той же schema (или руками той же формы).

## Дальше

- [Входящий payload](/ru/websocket/payload)
- [Генерация AsyncAPI](/ru/asyncapi/) — просканировать payload / emit в документ
- [Маршрутизация событий](/ru/websocket/channel)
