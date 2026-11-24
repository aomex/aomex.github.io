---
outline: deep
---

# Журнал доступа

У realtime-канала нет «URL + код статуса», но всё равно хочется знать: какой IP, какое соединение, какое событие только что обработали и сколько это заняло. `websocketAccessLog()` из `@aomex/access-log/websocket` пишет строку после того, как цепочка middleware для входящего сообщения дошла до конца (включая выброшенную ошибку).

```bash
pnpm add @aomex/access-log
```

## Сначала смотрите каждое входящее сообщение

Вешайте **перед** `channels()`, иначе не попадёте в строку после бизнес-обработки. Формат по умолчанию — `[ip] [clientId] [event] [duration]`, вывод в консоль:

```typescript
import { websocketAccessLog } from '@aomex/access-log/websocket';
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';

new WebsocketApp({
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  transport: new WsTransport(),
  mount: [websocketAccessLog(), channels('./src/channels')], // [!code highlight]
});
```

## Свой формат и бизнес-поля

Токены — `WebsocketAccessLogToken`. В `customTokens` приходит WebSocket-ctx; можно брать поля, которые вы раньше положили в `client.data`. Для записи на диск — `FileTransport`:

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

Удобно смотреть распределение событий и медленную обработку; **не** считайте это единственным аудитом чувствительных операций.

## Дальше

- [Точка входа](/ru/websocket/)
- [Маршрутизация событий](/ru/websocket/channel)
- Уровни вывода: [логгер](/ru/core/logger)
