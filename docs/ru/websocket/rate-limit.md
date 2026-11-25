---
outline: deep
---

# Ограничение частоты

На WebSocket лимитируется **каждое входящее сообщение**, не число соединений. `websocketRateLimit()` из `@aomex/rate-limit/websocket` — **перед** `channels()`: при превышении push `event: 'error'`, в бизнес не заходим, соединение открыто (не рвём, чтобы не устроить шторм переподключений).

```bash
pnpm add @aomex/rate-limit
# для общего счёта между репликами:
pnpm add @aomex/rate-limit-redis-store
```

## Сначала остановить спам

Окно — `window` (мс или `'10s'` / `'1 minute'`), число — `limit`. По умолчанию счётчик по `ctx.client.request.ip` — несколько соединений с одного IP делят квоту. `ctx.client.request` есть с handshake:

```typescript
import { websocketRateLimit } from '@aomex/rate-limit/websocket';
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';
import { logger } from '@/services/logger.service';

new WebsocketApp({
  logger,
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

Без параметров — 1 час / 2500, для чата часто мягко. «30 за 10 с» — против ботов.

## По пользователю, белый список

Свой `id` для учёта по логину; `false` — сообщение без лимита. `allowList` для отладки из внутренней сети; `denyList` для уже забаненных. Текст при превышении — `errorMessage` (иначе i18n «слишком часто»):

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
  errorMessage: 'Слишком часто, попробуйте позже',
});
```

## Реплики: Redis

Тот же `RateLimitRedisStore`, что на HTTP. Даже в одном store префикс ключей другой (`aomex-rate-limit:ws:…`), квота не смешивается с HTTP. Реальный IP — `proxyIP` Web-приложения.

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

- [Abuse](/ru/websocket/abuse)
- [Вход](/ru/websocket/)
- [Каналы](/ru/websocket/channel)