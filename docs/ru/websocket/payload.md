---
outline: deep
---

# Входящий payload

`data`, которое клиент присылает с событием, по умолчанию недоверенное. В mount события повесьте `payload()` и опишите поля уже знакомыми [валидаторами](/ru/validators/); после успеха в бизнес-коде используйте `ctx.payload` с суженными типами. При провале фреймворк пушит **этому соединению** `{ event: 'error', data: { message } }` и **не** заходит в `action` — та же идея, что HTTP body → 400 без входа в маршрут.

Сначала входящий чат:

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
    // 这里 ctx.payload.roomId / text 已经是 string
    await ctx.room(ctx.payload.roomId).send(
      'chat.message',
      { from: ctx.client.id, text: ctx.payload.text },
      { except: ctx.client },
    );
  },
});
```

Клиент по-прежнему шлёт по соглашению:

```typescript
socket.send(
  JSON.stringify({
    event: 'chat.send',
    data: { roomId: 'lobby', text: 'hello' },
  }),
);
```

Если `text` слишком длинный или нет `roomId`, в `onmessage` придёт `event === 'error'`, action даже не запустится. Не дублируйте в action `if (typeof raw.text !== 'string')` — это разъедется с валидацией, текстами ошибок и AsyncAPI.

::: tip
Без `payload()` тип `ctx.payload` — `unknown`, и в рантайме значения может не быть. Для отладки можно читать `ctx.rawPayload` (сырой `data` рамки); на боевом API всегда вешайте `payload()`.
:::

## Общие поля на несколько событий

Например, у каждого события может быть опциональный `token` — повесьте на конструктор Channel; у события свой `payload()` допишет бизнес-поля. По типам одноимённые поля, повешенные позже, перекрывают предыдущие.

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

Форма входа как у `body()` / `query()`: таблица полей, `rule.object()`, скаляр, `schema(...)`. При генерации [AsyncAPI](/ru/asyncapi/) эти объявления попадут во входящее message; без mount в документе кусок пустой, а рантайм всё ещё может «протащить» через `rawPayload` — на стыковке контракт легко не заметить.

::: tip
Бизнес-ошибки вроде лимита или отказа авторизации тоже принято отвечать `event: 'error'` (или отдельным событием из [emit](/ru/websocket/emit)). Фронту проще слушать мало выходов.
:::

## Дальше

- [Исходящий emit](/ru/websocket/emit)
- [Маршрутизация событий](/ru/websocket/channel)
- [Быстрый старт валидаторов](/ru/validators/)
