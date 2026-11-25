---
outline: deep
---

# Ограничение запросов

Считает по идентификатору клиента в окне времени; при превышении — **429**. Защита от перебора API и всплесков.

**Лимит по IP/соединению на весь сайт в проде лучше на Nginx** (`limit_req_zone` / `limit_req`): режет до Node, без Redis на репликах. `@aomex/rate-limit` уместнее для **бизнес-ключей** (пользователь / API Key), точечных роутов вроде SMS входа, или локально без reverse proxy.

По умолчанию **память процесса** — хватает на одну машину. Несколько реплик и общий счёт в приложении → Redis, иначе суммарный лимит ≈ `limit × число инстансов`.

```bash
pnpm add @aomex/rate-limit
# Несколько инстансов, общий счёт в приложении:
pnpm add @aomex/rate-limit-redis-store
```

## На всё приложение

Если на edge уже режут по IP, второй глобальный `rateLimit()` не нужен. Для бизнес-ключей или прямого локального доступа — `rateLimit()` ближе к началу mount: превышение в окне сразу **429**, без подсчёта в каждом action.

```typescript
import { rateLimit } from '@aomex/rate-limit';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
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

`window` — окно (мс или `'1 hour'`, `'30s'` и т.д.; по умолчанию час). `limit` — разрешённых запросов в окне (по умолчанию 2500). Без настроек: «по IP, 2500 в час» — локально можно ослабить, чтобы не залочить себя.

Обычный WebMiddleware; при превышении HTTP-ошибка **429**. Заголовки `X-RateLimit-*`; `headers: false` отключает.

## По ключу / пользователю, пропуск health

По умолчанию `id` — `ctx.request.ip`. Для API Key или пользователя — свой `id`; `false` — не считать эту запись (health). Внутренняя сеть целиком — `allowList`; жёсткий бан IP — `denyList` (**403**, без счётчика).

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

Только по IP за NAT — целый офис на одном ключе, ложные срабатывания. Логин/SMS — по пользователю или API Key. Слишком жёсткий глобальный лимит — чаще отдельный mount на горячих роутах.

## Один роут

Логин, капча — глобальный лимит слишком мягкий. `rateLimit()` на mount роута, рядом с `body()`.

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

## Прод, несколько реплик: Redis

Несколько Pod на memory — каждый считает сам, квота умножается. Общий счёт — `@aomex/rate-limit-redis-store`.

В конструктор только `RedisOptions` (`host` / `port` и т.д.; типы из пакета), не готовый экземпляр `Redis`. `ioredis` в комплекте. store с `lazyConnect`; `rateLimit()` через [`registerLifecycle`](/ru/core/service#хуки-жизненного-цикла) подключает/отключает.

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

Memory store явно — `@aomex/rate-limit/memory`. При остановке счётчики процесса сбрасываются. Свой store — атомарный `getAndSet` у `RateLimitStore`; при необходимости `onInit` / `onDestroy` (`rateLimit()` регистрирует). Сигнатуры — по типам пакета.

::: tip
С Nginx в проде: **сначала** `limit_req` по IP/соединению; в приложении — логин, SMS, квоты по ключу. Не дублируйте одинаково жёсткий IP-лимит с шлюзом.
:::

## Дальше

- Honey pot / накопление ошибок / бан IP: [abuse](/ru/plugins/abuse)
- Лимит сообщений WebSocket: [rate-limit WebSocket](/ru/websocket/rate-limit)
- Реальный IP (ключ): proxyIP в [Web](/ru/web/)
- Идентичность: [Auth](/ru/plugins/auth)
- Форма ошибок: [errors](/ru/web/errors)