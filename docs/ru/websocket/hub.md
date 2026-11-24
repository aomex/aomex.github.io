---
outline: deep
---

# Мультимашинный Hub

Hub помнит «кто в какой комнате» и «как раздать broadcast». Memory Hub по умолчанию знает только соединения **текущего Node-процесса** — для локальной разработки этого достаточно.

Когда обязательно нужен Redis Hub?

- В проде несколько Web-реплик, пользователь может попасть на разные машины
- Console (или другой процесс) тоже вызывает `ws.room(...).send` к браузерам, ещё висящим на Web-процессе

Транспорт (ws / Socket.IO) и Hub **независимы**: смена клиентского протокола ≠ смена Hub; мультимашина — только Hub.

Доставка по-прежнему best-effort: успешный Redis `PUBLISH` не значит, что каждая машина уже раздала, тем более что браузер уже показал сообщение.

## По умолчанию хватает: MemoryHub

Без `hub` автоматически берётся memory-реализация. На одной машине и для локальной стыковки так и оставляйте — `new WebsocketApp({ ... })` из статьи про вход уже в этом состоянии.

Ограничение: `room().send` в процессе A **не попадёт** в соединения процесса B. Если Web и Console — два процесса, send из Console браузер не увидит.

## Мультимашина: RedisHub

```bash
pnpm add @aomex/websocket-redis-hub
```

Каждая машина локально ведёт «какие соединения у меня и в каких комнатах»; межмашинный broadcast идёт через Redis Pub/Sub. Если в комнате на этой машине никого не осталось, подписка на канал снимается — пустых подписок не копят.

`host` / `port` / пароль — как у обычного ioredis. Если один Redis делят несколько проектов, обязательно смените `channel` (префикс Pub/Sub, по умолчанию `aomex:websocket:hub`) на неуникальный. `fanoutBatchSize` — сколько соединений раздавать за раз на этой машине; обычно не трогают.

```typescript
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';
import { RedisHub } from '@aomex/websocket-redis-hub';

export const ws = new WebsocketApp({
  logger: services.logger,
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

Реальные каналы: `{префикс}:a` (всем) и `{префикс}:r:{имя-комнаты}`. **Все процессы, которые должны общаться** (каждая Web-реплика, Console с пушем) обязаны: один Redis, один префикс `channel`.

::: warning
Даже с транспортом Socket.IO **не** вешайте официальный Redis adapter Socket.IO. Комнаты и broadcast знает только `hub` aomex; два слоя — мина под ногами.
:::

## Пуш из Console через процессы

Тот же приём, что в статье про вход: `ws` экспортируется из отдельного файла; Web-процесс делает `attach`; Console **только import, никогда attach**. При конструировании с обеих сторон — одна и та же конфигурация `RedisHub`:

```typescript
// Console 指令里
import { ws } from '../ws.js';

await ws.room(`order:${orderId}`).send('order.updated', order);
await ws.all.send('system.notice', { text: '今晚 23:00 维护' });
```

Перед отправкой дождутся готовности Hub. Клиент, который тогда был офлайн, ничего не получит — при следующем открытии страницы подтяните состояние по HTTP.

## Дальше

- [Точка входа](/ru/websocket/) — attach и приёмы пуша
- [Транспорт](/ru/websocket/transport)
- [Мультипроцесс и масштабирование](/ru/advanced/cluster)
