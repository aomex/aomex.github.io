---
outline: deep
---

# Журнал доступа

У realtime-канала нет «URL + статус», но нужно знать: какой IP, какое соединение, какое событие обработано и за сколько мс. `websocketAccessLog()` из `@aomex/access-log/websocket` — одна строка после прохода цепочки middleware (включая ошибки).

```bash
pnpm add @aomex/access-log
```

## Сначала каждое входящее сообщение

Вешай **перед** `channels()`, иначе не увидишь строку после бизнес-логики. Формат по умолчанию `[ip] [clientId] [event] [duration]`, в консоль:

```typescript
import { websocketAccessLog } from '@aomex/access-log/websocket';
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';
import { logger } from '@/services/logger.service';

new WebsocketApp({
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  transport: new WsTransport(),
  mount: [websocketAccessLog(), channels('./src/channels')], // [!code highlight]
});
```

## Формат и бизнес-поля

Токены — `WebsocketAccessLogToken`. В `customTokens` ctx WebSocket — поля из `client.data`. Для файла — `FileTransport`:

```typescript
import {
  WebsocketAccessLogToken,
  websocketAccessLog,
} from '@aomex/access-log/websocket';
import { FileTransport } from '@aomex/logger';

websocketAccessLog({ // [!code focus:14]
  format: [
    WebsocketAccessLogToken.event,
    WebsocketAccessLogToken.clientId,
    '[room]',
    WebsocketAccessLogToken.duration,
  ].join(' '),
  transports: [new FileTransport({ file: './logs/ws-access.log' })],
  customTokens: {
    room: (ctx) => {
      return String(ctx.client.data['room'] ?? '-');
    },
  },
});
```

Для распределения событий и медленных обработок, **не единственный аудит чувствительных операций**.

## Дальше

- [Вход приложения](/ru/websocket/)
- [Маршруты событий](/ru/websocket/channel)
- Уровни: [логгер](/ru/core/logger)