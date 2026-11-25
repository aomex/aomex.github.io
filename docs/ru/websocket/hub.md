---
outline: deep
---

# Hub для нескольких машин

Hub хранит «кто в какой комнате» и как разослать broadcast. Память по умолчанию знает только соединения **текущего процесса Node** — для локальной разработки хватает.

Когда нужен Redis Hub?

- Несколько реплик Web в проде, пользователь попадает на разные машины
- Console (или другой процесс) должен `ws.room(...).send` браузерам на Web-процессах

Транспорт (ws / Socket.IO) и Hub **независимы**: смена протокола клиента не требует смены Hub; для multi-instance меняют только Hub.

Доставка best-effort: успешный Redis `PUBLISH` ≠ fanout на всех машинах ≠ сообщение уже на экране.

## По умолчанию: MemoryHub

Без `hub` — память. Один сервер, локальная отладка — оставь так; `new WebsocketApp({ ... })` из входной статьи уже в этом режиме.

Ограничение: `room().send` в процессе A **не дойдёт** до соединений в B. Web и Console в разных процессах — браузер ничего не получит.

## Multi-instance: RedisHub

```bash
pnpm add @aomex/websocket-redis-hub
```

На каждой машине локально «свои соединения и комнаты»; между машинами — Redis Pub/Sub. Нет клиентов комнаты на машине — отписка от канала, без пустых подписок.

`host` / `port` / пароль как у ioredis. Общий Redis у проектов — меняй `channel` (префикс Pub/Sub, default `aomex:websocket:hub`). `fanoutBatchSize` — сколько соединений fanout за раз, обычно не трогают.

```typescript
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';
import { RedisHub } from '@aomex/websocket-redis-hub';
import { logger } from '@/services/logger.service';

export const ws = new WebsocketApp({
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  transport: new WsTransport(),
  hub: new RedisHub({ // [!code focus:5]
    host: '127.0.0.1',
    port: 6379,
    channel: 'aomex:websocket:hub',
    fanoutBatchSize: 512,
  }),
  mount: [channels('./src/channels')],
});
```

Каналы: `{prefix}:a` (всем) и `{prefix}:r:{room}`. **Все процессы**, которые должны общаться (реплики Web, Console с push), — один Redis и один префикс `channel`.

::: warning
С Socket.IO **не** вешай официальный Redis adapter Socket.IO. Комнаты и broadcast — только hub aomex; два слоя — ловушка при отладке.
:::

## Push из Console через процессы

Как во входной статье: `ws` в отдельном файле; Web делает `attach`; Console **только import, без attach**. Одинаковый `RedisHub` при создании:

```typescript
// в команде Console
import { ws } from '@/ws';

await ws.room(`order:${orderId}`).send('order.updated', order);
await ws.all.send('system.notice', { text: '今晚 23:00 维护' });
```

Перед отправкой ждёт готовности Hub. Офлайн-клиенты не получат — при следующем открытии страницы подтяни состояние по HTTP.

## Дальше

- [Вход приложения](/ru/websocket/) — attach и push
- [Транспорт](/ru/websocket/transport)
- [Кластер](/ru/advanced/cluster)