---
outline: deep
---

# Ограничение частоты

Считает запросы по идентификатору клиента внутри временного окна; при превышении возвращает **429**. Нужно, чтобы гасить скрейпинг и всплески трафика.

**Для общесайтовых лимитов по IP / соединению в проде лучше Nginx** (`limit_req_zone` / `limit_req`): запрос не доходит до Node, и нескольким репликам не нужен Redis в первую очередь. `@aomex/rate-limit` уместен для **пользовательских / API Key бизнес-ключей**, ужесточения одного маршрута (логин, SMS) или локальной защиты без обратного прокси.

По умолчанию счётчик — **память процесса**: для одной машины хватает. Несколько реплик с общим счётом в приложении требуют Redis, иначе фактический потолок ≈ `limit × число инстансов`.

```bash
pnpm add @aomex/rate-limit
# Несколько инстансов и нужен общий счёт в приложении:
pnpm add @aomex/rate-limit-redis-store
```

## Повесить на весь сайт

Если край уже режет по IP, второй общесайтовый `rateLimit()` в приложении не нужен. Для бизнес-ключей или локального прямого доступа ставьте `rateLimit()` ближе к началу mount: превышение в окне → сразу **429**, без счётчиков в каждом action.

```typescript
import { rateLimit } from '@aomex/rate-limit';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'ru-RU' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:7]
    rateLimit({
      limit: 100,
      window: 60_000, // [!code highlight]
    }),
    routers('./src/routers'),
  ],
});
```

`window` — окно счёта (миллисекунды или читаемые длительности вроде `'1 hour'` / `'30s'`; по умолчанию 1 час). `limit` — сколько раз разрешено в окне (по умолчанию 2500). Без опций получается «по IP, 2500 в час» — локально лучше ослабить, чтобы не заблокировать себя при отладке.

Обычный WebMiddleware; при превышении бросает HTTP-ошибку со статусом **429**. В ответе есть заголовки `X-RateLimit-*`; `headers: false` их отключает.

## По Key / пользователю, пропуск health-check

По умолчанию `id` — `ctx.request.ip`. Чтобы делить бакеты по API Key или залогиненному пользователю, напишите свой `id`; `false` значит «эту строку не считать» (часто для health-check). Всю интрасеть пропускает `allowList`; отдельные IP режет `denyList` (попадание → **403**, без счёта).

```typescript
rateLimit({
  limit: 60,
  window: 60_000,
  id: (ctx) => { // [!code highlight]
    if (ctx.request.pathname === '/health') {
      return false;
    }
    const key = ctx.request.headers['x-api-key'];
    if (typeof key === 'string') {
      return key;
    }
    return ctx.request.ip;
  },
  allowList: (ctx) => {
    return ctx.request.ip === '127.0.0.1';
  },
});
```

Лимит только по IP за NAT даёт один ключ на весь офис — легко задеть своих. Логин и SMS лучше считать по пользователю или API Key. Если общесайтовый потолок слишком мягок, на горячие маршруты чаще вешают отдельный mount.

## Ограничить один маршрут

Логин и капча часто нуждаются в более жёстком потолке, чем общесайтовый. Повесьте `rateLimit()` в mount этого маршрута рядом с `body()`.

```typescript
import { body } from '@aomex/web';
import { rule } from '@aomex/common';

router.post('/login', {
  mount: [
    rateLimit({ limit: 10, window: 60_000 }), // [!code highlight]
    body({ email: rule.email(), password: rule.string() }),
  ],
  action: async (ctx) => {
    /* ... */
  },
});
```

## Прод с несколькими репликами: Redis

Если у каждого Pod остаётся память по умолчанию, инстансы считают по отдельности и суммарная квота умножается. Для общего счёта переключитесь на `@aomex/rate-limit-redis-store`.

В конструктор передавайте только `RedisOptions` (`host` / `port` и т.д.; типы можно взять из пакета) — не готовый экземпляр `Redis`. `ioredis` уже в комплекте, отдельно ставить не нужно. Store внутри делает `lazyConnect`; `rateLimit()` регистрирует connect / disconnect через [`registerLifecycle`](/ru/core/service#хуки-жизненного-цикла).

```typescript
import { RateLimitRedisStore } from '@aomex/rate-limit-redis-store';

rateLimit({
  store: new RateLimitRedisStore({ // [!code highlight]
    host: '127.0.0.1',
    port: 6379,
  }),
  limit: 500,
  window: 3_600_000,
  id: (ctx) => {
    const key = ctx.request.headers['x-api-key'];
    if (typeof key === 'string') {
      return key;
    }
    return ctx.request.ip;
  },
});
```

Память по умолчанию можно явно импортировать из `@aomex/rate-limit/memory`; при остановке процессные счётчики очищаются. Свой store реализует атомарный `getAndSet` у `RateLimitStore`; для connect / disconnect переопределяйте `onInit` / `onDestroy` (`rateLimit()` зарегистрирует сам). Сигнатуры — по типам.

::: tip
В проде с Nginx: **сначала** `limit_req` и аналоги для IP / соединений; слой приложения — для логина, SMS и квот по Key. Не накладывайте один и тот же слишком жёсткий IP-лимит на шлюз и приложение, иначе ложные блокировки.
:::

## Дальше

- Honeypot / накопление ошибок / блокировка IP: [Защита от злоупотреблений](/ru/plugins/abuse)
- Лимит входящих сообщений WebSocket: [Ограничение частоты (WebSocket)](/ru/websocket/rate-limit)
- Реальный IP клиента (ключ лимита): `proxyIP` на [входе Web](/ru/web/)
- Измерение личности: [Auth](/ru/plugins/auth)
- Форма ошибок: [Формат ошибок](/ru/web/errors)
