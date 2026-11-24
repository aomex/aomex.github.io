---
outline: deep
---

# Защита от злоупотреблений

Типичная разведка realtime-канала — перебор «событий, которых вообще не должно быть». `.socket()` из `@aomex/abuse` делает две вещи: проверяет, не забанен ли уже IP; по стратегии `socket-events` считает удары по приманкам и при лимите банит IP.

Состояние бана с HTTP-стороной **общее** (тот же экземпляр `createAbuse`, тот же `store`): IP, пойманный HTTP-honeypot, не пройдёт и WebSocket. IP на handshake зависит от `proxyIP` Web-приложения — ошибка настройки значит бан не тех людей.

```bash
pnpm add @aomex/abuse
# 还需已有的 @aomex/cache（及生产用的 Redis 适配器）
```

## Сначала повесьте honeypot имён событий

`createAbuse` возвращает сервис, а не middleware, который сразу кладут в mount. На WebSocket — **`abuse.socket()`**, перед `channels()`. Если в HTTP-приложении уже есть `createAbuse`, **переиспользуйте тот же объект**, второй new не нужен. Локально — memory; на нескольких репликах — Redis-адаптер.

::: warning
Перед вызовом уже должен быть `import '@aomex/websocket'` (регистрация `middleware.socket`).
:::

Приманки пишите в `events` стратегии `socket-events`: строки с `*` или регулярки (полное совпадение с `ctx.event`). Попадание считает по IP; при лимите — бан. `events` не может быть пустым — проверка уже при create.

```typescript
import { createAbuse } from '@aomex/abuse';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';

const abuse = createAbuse({
  store: new CacheMemoryAdapter(),
  strategies: [
    { // [!code focus:7]
      strategy: 'socket-events',
      events: ['admin.destroy', 'debug.*', /^internal\./],
      limit: 1,
      window: '1 hour',
      blockFor: '1 day',
    },
  ],
});

new WebsocketApp({
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  transport: new WsTransport(),
  mount: [
    abuse.socket(),
    channels('./src/channels'),
  ],
});
```

## Что отвечать после бана

Если IP уже заблокирован или счётчик `socket-events` только что достиг лимита: сначала уходит `{ event: 'error', data: { message } }`, затем соединение закрывается кодом **1008** (Policy Violation) — бан это не мягкий rate limit, сокет не должен продолжать висеть. `errorMessage` — и текст error-кадра, и close reason (транспорт может обрезать слишком длинный reason). Whitelist настраивается на `.socket()`: `bypass` → `true` пропускает проверку:

```typescript
mount: [
  abuse.socket({ // [!code focus:6]
    bypass: (ctx) => {
      return ctx.client.request.ip === '127.0.0.1';
    },
    errorMessage: '已限制访问',
  }),
  channels('./src/channels'),
],
```

## Репорт из Channel

Если стратегии `ip-abuse` / `user-abuse` уже заданы в `createAbuse`, из action Channel можно звать тот же API (например, поймали спамера). `ctx.client.request` есть с handshake — берите IP напрямую:

```typescript
channel.on('chat.send', {
  mount: [payload({ text: rule.string() })],
  action: async (ctx) => {
    if (looksLikeSpam(ctx.payload.text)) {
      await abuse.ipAbuse(ctx.client.request.ip, 'chat-spam');
    }
    // …
  },
});
```

Как объявлять стратегии, `onBanUser` / `blockIP` и прочие API — те же, что на HTTP; path-honeypot и накопление статус-кодов см. [защиту от злоупотреблений](/ru/plugins/abuse) под Web-приложением.

## Дальше

- [Ограничение частоты](/ru/websocket/rate-limit)
- [Точка входа](/ru/websocket/)
- [Маршрутизация событий](/ru/websocket/channel)
