---
outline: deep
---

# Ограничение частоты запросов

Кто-то держит соединение и бесконечно делает `send` — WebSocket лимитирует **каждое входящее сообщение** (не число соединений). `websocketRateLimit()` из `@aomex/rate-limit/websocket` вешайте **перед** `channels()`: при превышении ответит рамкой `event: 'error'`, в бизнес **не** зайдёт, соединение останется открытым (не рвём — иначе клиент сразу переподключится и продолжит долбить).

```bash
pnpm add @aomex/rate-limit
# 多副本共享计数时：
pnpm add @aomex/rate-limit-redis-store
```

## Сначала остановите спам

Окно — `window` (миллисекунды или читаемые `'10s'` / `'1 minute'`), число — `limit`. По умолчанию счётчик по `ctx.client.request.ip`: несколько соединений с одного IP делят квоту. `ctx.client.request` есть уже на handshake, «пустоты» не бойтесь:

```typescript
import { websocketRateLimit } from '@aomex/rate-limit/websocket';
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';

new WebsocketApp({
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  transport: new WsTransport(),
  mount: [ // [!code focus:6]
    websocketRateLimit({
      limit: 30,
      window: '10s', // [!code highlight]
    }),
    channels('./src/channels'),
  ],
});
```

Без параметров по умолчанию — 1 час / 2500 раз, для большинства чатов довольно мягко; вариант «30 за 10 секунд» лучше держит спам-ботов.

## Счёт по залогиненному пользователю и списки

Считать по пользователю — напишите свой `id`; `false` значит это сообщение не лимитировать. Для внутренней отладки — `allowList`; для уже забаненных — `denyList` сразу откажет. Текст при превышении — `errorMessage` (по умолчанию i18n «слишком частые запросы»):

```typescript
websocketRateLimit({ // [!code focus:18]
  limit: 60,
  window: '1 minute',
  id: (ctx) => {
    const userId = ctx.client.data['userId'];
    if (typeof userId === 'string') {
      return userId;
    }
    return ctx.client.request.ip;
  },
  allowList: (ctx) => {
    return ctx.client.request.ip === '127.0.0.1';
  },
  denyList: (ctx) => {
    return ctx.client.data['banned'] === true;
  },
  errorMessage: '发送过于频繁，稍后再试',
});
```

## Несколько реплик: Redis

Тот же `RateLimitRedisStore`, что и на HTTP. Даже если вложить один экземпляр store, префиксы ключей разные (`aomex-rate-limit:ws:…`) — квота WebSocket не съест HTTP-лимит. Реальный IP зависит от `proxyIP` на Web-приложении (handshake идёт через тот же путь).

```typescript
import { RateLimitRedisStore } from '@aomex/rate-limit-redis-store';

websocketRateLimit({ // [!code focus:8]
  store: new RateLimitRedisStore({
    host: '127.0.0.1',
    port: 6379,
  }),
  limit: 30,
  window: '10s',
});
```

## Дальше

- [Защита от злоупотреблений](/ru/websocket/abuse)
- [Точка входа](/ru/websocket/)
- [Маршрутизация событий](/ru/websocket/channel)
