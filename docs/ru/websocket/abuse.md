---
outline: deep
---

# Защита от злоупотреблений

В реальном времени часто сканируют несуществующие имена событий. `.socket()` из `@aomex/abuse` делает две вещи: проверяет, заблокирован ли IP; стратегия `socket-events` считает подставные события и банит IP по лимиту.

Состояние бана **общее** с HTTP (один `Abuse`, один `store`): IP, забаненный honeypot'ом Web, не подключится по WebSocket. IP рукопожатия зависит от `proxyIP` Web-приложения — ошибка = не тот человек.

```bash
pnpm add @aomex/abuse
# также нужен @aomex/cache (в проде — Redis-адаптер)
```

## Сначала honeypot имён событий

`new Abuse(...)` — сервис, не middleware напрямую в mount. Для WebSocket — **`abuse.socket()`** перед `channels()`. Если в HTTP уже создавали экземпляр — **переиспользуй**. Локально memory; несколько реплик — Redis.

::: warning
Перед вызовом нужен `import '@aomex/websocket'` (регистрация `middleware.socket`).
:::

«Приманки» в `events` стратегии `socket-events`: строки с `*`, можно regex (полное совпадение с `ctx.event`). Попадание — счётчик по IP, лимит — бан. `events` не пустой, валидируется при создании.

```typescript
import { Abuse } from '@aomex/abuse';
import { Caching } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';
import { logger } from '@/services/logger.service';

const cache = new Caching(new CacheMemoryAdapter());

const abuse = new Abuse({
  store: cache,
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
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  transport: new WsTransport(),
  mount: [
    abuse.socket(),
    channels('./src/channels'),
  ],
});
```

## Что вернётся после бана

IP уже в бане или `socket-events` только что достиг лимита: сначала push `{ event: 'error', data: { message } }`, затем разрыв с кодом **1008** (Policy Violation) — это не мягкий rate limit, соединение не должно висеть. `errorMessage` — текст error-кадра и close reason (слишком длинный reason обрежет транспорт). Белый список в `.socket()` — `bypass` возвращает `true` и пропускает проверку:

```typescript
mount: [
  abuse.socket({ // [!code focus:6]
    bypass: (ctx) => {
      return ctx.client.request.ip === '127.0.0.1';
    },
    errorMessage: 'Доступ ограничен',
  }),
  channels('./src/channels'),
],
```

## Репорт из Channel

Если при создании `Abuse` настроены `ip-abuse` / `user-abuse`, в action Channel тот же API (например, спам). `ctx.client.request` есть с handshake:

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

Объявление стратегий, `onBanUser` / `blockIP` — как на HTTP. Honeypot путей и накопление статусов — [abuse для Web](/ru/plugins/abuse).

## Дальше

- [Rate limit](/ru/websocket/rate-limit)
- [Вход приложения](/ru/websocket/)
- [Маршруты событий](/ru/websocket/channel)